import fs from "fs";
import { parse } from "csv-parse";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import OpenAI from "openai";
import dotenv from "dotenv";
import { Document, Packer, Paragraph, TextRun } from "docx";

// Carrega variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lê um arquivo CSV de links de vagas e retorna os dados processados
 * @param {string} csvFilePath - Caminho para o arquivo CSV
 * @returns {Promise<Array>} Array de objetos com os dados das vagas
 */
async function lerCSVVagas(csvFilePath) {
  return new Promise((resolve, reject) => {
    const resultados = [];

    // Verifica se o arquivo existe
    if (!fs.existsSync(csvFilePath)) {
      reject(new Error(`Arquivo não encontrado: ${csvFilePath}`));
      return;
    }

    // Cria stream de leitura do arquivo
    const stream = fs.createReadStream(csvFilePath);

    // Configura o parser CSV
    const parser = parse({
      columns: true, // Usa a primeira linha como cabeçalho
      skip_empty_lines: true,
      trim: true,
    });

    // Processa cada linha do CSV
    parser.on("readable", function () {
      let registro;
      while ((registro = parser.read()) !== null) {
        resultados.push(registro);
      }
    });

    // Trata erros
    parser.on("error", function (err) {
      reject(err);
    });

    // Finaliza quando terminar de ler
    parser.on("end", function () {
      resolve(resultados);
    });

    // Conecta o stream ao parser
    stream.pipe(parser);
  });
}

/**
 * Lê o arquivo de currículo
 * @param {string} curriculoPath - Caminho para o arquivo de currículo
 * @returns {Promise<string>} Conteúdo do currículo
 */
async function lerCurriculo(curriculoPath) {
  try {
    // Verifica se o arquivo existe
    if (!fs.existsSync(curriculoPath)) {
      throw new Error(`Arquivo de currículo não encontrado: ${curriculoPath}`);
    }

    // Lê o arquivo
    const conteudo = fs.readFileSync(curriculoPath, "utf-8");
    return conteudo.trim();
  } catch (error) {
    throw new Error(`Erro ao ler arquivo de currículo: ${error.message}`);
  }
}

/**
 * Extrai o ID da vaga de um link de busca do LinkedIn
 * @param {string} link - URL de busca do LinkedIn
 * @returns {string|null} ID da vaga ou null se não encontrar
 */
function extrairJobIdDoLink(link) {
  try {
    const url = new URL(link);
    const currentJobId = url.searchParams.get("currentJobId");
    return currentJobId;
  } catch (error) {
    // Tenta extrair manualmente se URL falhar
    const match = link.match(/currentJobId=(\d+)/);
    return match ? match[1] : null;
  }
}

/**
 * Constrói o link direto da vaga a partir do ID
 * @param {string} jobId - ID da vaga
 * @returns {string} Link direto da vaga
 */
function construirLinkVaga(jobId) {
  return `https://www.linkedin.com/jobs/view/${jobId}`;
}

/**
 * Baixa a descrição de uma vaga a partir do link
 * @param {string} link - URL da vaga (pode ser link de busca ou link direto)
 * @param {puppeteer.Browser} browser - Instância do navegador Puppeteer
 * @returns {Promise<string>} Descrição da vaga
 */
async function baixarDescricaoVaga(link, browser) {
  try {
    const page = await browser.newPage();

    // Configura user agent para evitar bloqueios
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Verifica se é um link de busca e extrai o ID da vaga
    let linkVaga = link;
    if (link.includes("jobs/search") && link.includes("currentJobId")) {
      const jobId = extrairJobIdDoLink(link);
      if (jobId) {
        linkVaga = construirLinkVaga(jobId);
        console.log(`  Link de busca detectado. ID da vaga: ${jobId}`);
        console.log(`  Acessando vaga direta: ${linkVaga}`);
      } else {
        console.log(`  Não foi possível extrair ID da vaga do link de busca`);
      }
    } else {
      console.log(`  Acessando: ${linkVaga}`);
    }

    // Tenta extrair jobId do query (currentJobId) ou do path (/jobs/view/12345)
    const jobIdFromQuery = extrairJobIdDoLink(link);
    console.log(`  ID da vaga extraído do query: ${jobIdFromQuery}`);
    const jobIdFromPathMatch = link.match(/\/jobs\/view\/(\d+)/);
    const jobIdFromPath = jobIdFromPathMatch ? jobIdFromPathMatch[1] : null;
    const jobId = jobIdFromQuery || jobIdFromPath;

    if (jobId) {
      linkVaga = construirLinkVaga(jobId);
      console.log(`  ID da vaga extraído: ${jobId}`);
      console.log(`  Acessando vaga direta: ${linkVaga}`);
    } else {
      console.log(`  Acessando: ${linkVaga}`);
    }

    await page.goto(linkVaga, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Aguarda o carregamento inicial
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Faz scroll na página para garantir que o conteúdo seja carregado
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Tenta clicar no botão "Ver mais" / "Show more" para expandir a descrição completa
    try {
      const botaoVerMais = await page.evaluateHandle(() => {
        // Procura por botões que expandem a descrição
        const botoes = Array.from(document.querySelectorAll("button, a, span"));
        for (let botao of botoes) {
          const texto = (
            botao.textContent ||
            botao.innerText ||
            ""
          ).toLowerCase();
          if (
            texto.includes("ver mais") ||
            texto.includes("show more") ||
            texto.includes("see more") ||
            texto.includes("expandir") ||
            (botao.getAttribute("aria-label") &&
              botao.getAttribute("aria-label").toLowerCase().includes("more"))
          ) {
            return botao;
          }
        }
        return null;
      });

      if (botaoVerMais && botaoVerMais.asElement()) {
        await botaoVerMais.asElement().click();
        console.log('  Botão "Ver mais" clicado para expandir descrição');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (e) {
      // Continua mesmo se não encontrar o botão
    }

    // Aguarda o carregamento da página e tenta aguardar por elementos específicos
    try {
      // Tenta aguardar por seletores comuns de descrição
      await page
        .waitForSelector(
          '.show-more-less-html__markup, .jobs-description-content__text, [data-test-id="job-details-description"], .jobs-box__html-content',
          {
            timeout: 10000,
          }
        )
        .catch(() => {
          // Se não encontrar, continua mesmo assim
        });
    } catch (e) {
      // Continua mesmo se não encontrar o seletor
    }

    // Aguarda um pouco mais para garantir que o conteúdo seja carregado
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Tenta fazer scroll até a seção de descrição
    try {
      await page.evaluate(() => {
        // Procura por elementos que possam ser a descrição
        const elementosDescricao = document.querySelectorAll(
          '.show-more-less-html__markup, .jobs-description-content__text, [data-test-id="job-details-description"]'
        );
        if (elementosDescricao.length > 0) {
          elementosDescricao[0].scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {
      // Continua mesmo se falhar
    }

    // Tenta extrair a descrição da vaga do LinkedIn
    // Foca nos seletores específicos do LinkedIn para páginas de vagas
    const descricao = await page.evaluate(() => {
      // Lista de seletores específicos do LinkedIn para descrição de vagas (em ordem de prioridade)
      const seletoresPrioritarios = [
        ".show-more-less-html__markup",
        ".jobs-description-content__text",
        '[data-test-id="job-details-description"]',
        ".jobs-box__html-content",
        ".description__text",
        ".jobs-description__content",
        'div[class*="jobs-description"]',
        'section[class*="jobs-description"]',
        '[class*="description__text"]',
        '[class*="job-details"]',
        ".jobs-description__text",
        '[id*="job-details"]',
        'div[class*="jobs-details"]',
        'section[class*="jobs-details"]',
        '[data-test-id*="description"]',
        '[data-test-id*="job"]',
      ];

      // Tenta cada seletor em ordem de prioridade
      for (const seletor of seletoresPrioritarios) {
        try {
          const elemento = document.querySelector(seletor);
          if (elemento) {
            // Tenta pegar o texto completo, incluindo texto oculto
            let texto = "";

            // Primeiro tenta innerText (mais confiável)
            texto = elemento.innerText || elemento.textContent || "";

            // Se o texto for muito curto, tenta pegar o HTML e converter
            if (texto.trim().length < 200) {
              const html = elemento.innerHTML || "";
              // Remove tags HTML mas mantém o conteúdo
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = html;
              texto = tempDiv.innerText || tempDiv.textContent || texto;
            }

            const textoLimpo = texto.trim();

            // Verifica se tem conteúdo suficiente e não é apenas navegação/metadados
            if (
              textoLimpo.length > 300 &&
              !textoLimpo.toLowerCase().includes("linkedin") &&
              !textoLimpo.toLowerCase().includes("entrar") &&
              !textoLimpo.toLowerCase().includes("cadastre-se") &&
              !textoLimpo.toLowerCase().includes("política de privacidade") &&
              !textoLimpo.toLowerCase().includes("nível de experiência") &&
              !textoLimpo.toLowerCase().includes("tipo de emprego") &&
              !textoLimpo.toLowerCase().includes("função") &&
              !textoLimpo.toLowerCase().includes("setores") &&
              !textoLimpo.toLowerCase().includes("assistente") &&
              !textoLimpo.toLowerCase().includes("tempo integral") &&
              !textoLimpo.toLowerCase().includes("tecnologia da informação") &&
              !textoLimpo.toLowerCase().includes("desenvolvimento de software")
            ) {
              return textoLimpo;
            }
          }
        } catch (e) {
          // Continua para o próximo seletor
        }
      }

      // Estratégia adicional: procura por todos os elementos com data-test-id relacionados a job
      const elementosTestId = document.querySelectorAll(
        '[data-test-id*="job"], [data-test-id*="description"], [data-test-id*="detail"]'
      );
      for (let elemento of elementosTestId) {
        const texto = (elemento.innerText || elemento.textContent || "").trim();
        if (
          texto.length > 500 &&
          !texto.toLowerCase().includes("linkedin") &&
          !texto.toLowerCase().includes("nível de experiência") &&
          !texto.toLowerCase().includes("tipo de emprego") &&
          !texto.toLowerCase().includes("função") &&
          !texto.toLowerCase().includes("setores")
        ) {
          return texto;
        }
      }

      // Estratégia alternativa: procura por elementos com atributos específicos do LinkedIn
      const elementosComAtributos = document.querySelectorAll(
        '[data-test-id], [class*="job"], [class*="description"]'
      );
      for (let elemento of elementosComAtributos) {
        const texto = (elemento.textContent || elemento.innerText || "").trim();
        // Verifica se é um elemento de descrição válido
        if (
          texto.length > 300 &&
          !texto.toLowerCase().includes("linkedin") &&
          !texto.toLowerCase().includes("entrar") &&
          !texto.toLowerCase().includes("cadastre-se") &&
          !texto.toLowerCase().includes("política") &&
          !texto.toLowerCase().includes("cookie")
        ) {
          // Verifica se contém palavras-chave comuns em descrições de vagas
          const palavrasChave = [
            "responsabilidade",
            "requisito",
            "experiência",
            "habilidade",
            "trabalho",
            "equipe",
            "desenvolvimento",
            "projeto",
            "tecnologia",
            "atribuição",
            "desejável",
            "diferencial",
            "benefício",
            "salário",
          ];
          const temPalavrasChave = palavrasChave.some((palavra) =>
            texto.toLowerCase().includes(palavra)
          );

          if (temPalavrasChave) {
            return texto;
          }
        }
      }

      // Procura especificamente por seções que contenham parágrafos longos (comum em descrições)
      const secoesComParagrafos = document.querySelectorAll(
        "section, div, article"
      );
      for (let secao of secoesComParagrafos) {
        const paragrafos = secao.querySelectorAll("p, li, div, span");
        let textoCompleto = "";
        let contadorParagrafos = 0;

        for (let p of paragrafos) {
          const textoP = (p.textContent || p.innerText || "").trim();
          // Ignora textos muito curtos ou que são apenas metadados
          if (
            textoP.length > 50 &&
            !textoP.toLowerCase().includes("nível de experiência") &&
            !textoP.toLowerCase().includes("tipo de emprego") &&
            !textoP.toLowerCase().includes("função") &&
            !textoP.toLowerCase().includes("setores") &&
            !textoP.toLowerCase().includes("assistente") &&
            !textoP.toLowerCase().includes("tempo integral")
          ) {
            textoCompleto += textoP + "\n\n";
            contadorParagrafos++;
          }
        }

        // Se encontrou vários parágrafos longos, provavelmente é a descrição
        if (contadorParagrafos >= 3 && textoCompleto.length > 500) {
          const textoLimpo = textoCompleto.trim();
          if (
            !textoLimpo.toLowerCase().includes("linkedin") &&
            !textoLimpo.toLowerCase().includes("entrar") &&
            !textoLimpo.toLowerCase().includes("cadastre-se")
          ) {
            return textoLimpo;
          }
        }
      }

      // Estratégia: procura por elementos que contenham palavras-chave de descrição
      const palavrasChaveDescricao = [
        "responsabilidade",
        "atribuição",
        "requisito",
        "desejável",
        "diferencial",
        "benefício",
        "salário",
        "remoto",
        "presencial",
        "desenvolvimento",
        "projeto",
        "equipe",
        "tecnologia",
      ];
      const todosDivs = Array.from(document.querySelectorAll("div, section"));
      for (let div of todosDivs) {
        const texto = (div.innerText || div.textContent || "").trim();
        if (texto.length > 400) {
          const textoLower = texto.toLowerCase();
          const temPalavrasChave = palavrasChaveDescricao.some((palavra) =>
            textoLower.includes(palavra)
          );
          const naoTemMetadados =
            !textoLower.includes("nível de experiência") &&
            !textoLower.includes("tipo de emprego") &&
            !textoLower.includes("função") &&
            !textoLower.includes("setores") &&
            !textoLower.includes("linkedin");

          if (temPalavrasChave && naoTemMetadados) {
            return texto;
          }
        }
      }

      // Estratégia: encontra o elemento com mais texto relevante
      const todosElementos = Array.from(
        document.querySelectorAll("div, section, article, main")
      );
      let melhorElemento = null;
      let maiorTamanho = 0;

      for (let elemento of todosElementos) {
        const texto = (elemento.textContent || elemento.innerText || "").trim();

        // Filtra elementos que não são descrições
        if (
          texto.length > 500 &&
          !texto.toLowerCase().includes("linkedin") &&
          !texto.toLowerCase().includes("entrar") &&
          !texto.toLowerCase().includes("cadastre-se") &&
          !texto.toLowerCase().includes("política") &&
          !texto.toLowerCase().includes("cookie") &&
          !texto.toLowerCase().includes("sobre a linkedin") &&
          !texto.toLowerCase().includes("acessibilidade")
        ) {
          // Verifica se contém palavras-chave de descrição de vagas
          const palavrasChave = [
            "responsabilidade",
            "requisito",
            "experiência",
            "habilidade",
            "atribuição",
            "desejável",
            "diferencial",
            "benefício",
          ];
          const temPalavrasChave = palavrasChave.some((palavra) =>
            texto.toLowerCase().includes(palavra)
          );

          if (temPalavrasChave && texto.length > maiorTamanho) {
            maiorTamanho = texto.length;
            melhorElemento = texto;
          }
        }
      }

      if (melhorElemento) {
        return melhorElemento;
      }

      // Último fallback: procura por elementos main ou article com muito texto
      const elementosPrincipais = document.querySelectorAll(
        'main, article, [role="main"]'
      );
      for (let elemento of elementosPrincipais) {
        const texto = (elemento.textContent || elemento.innerText || "").trim();
        if (texto.length > 500) {
          // Remove textos comuns de navegação/rodapé
          const textoLimpo = texto
            .replace(/LinkedIn/g, "")
            .replace(/Entrar/gi, "")
            .replace(/Cadastre-se/gi, "")
            .replace(/Política.*?/gi, "")
            .replace(/Cookie.*?/gi, "")
            .replace(/Sobre a LinkedIn.*?/gi, "")
            .trim();

          if (textoLimpo.length > 300) {
            return textoLimpo;
          }
        }
      }

      // Se chegou até aqui, tenta uma última estratégia: pegar todo o conteúdo principal
      // e filtrar apenas o que parece ser descrição
      const mainContent = document.querySelector(
        'main, [role="main"], .jobs-search__job-details'
      );
      if (mainContent) {
        const textoMain = (
          mainContent.innerText ||
          mainContent.textContent ||
          ""
        ).trim();
        if (textoMain.length > 1000) {
          // Divide o texto em linhas e filtra
          const linhas = textoMain.split("\n").filter((linha) => {
            const linhaLower = linha.toLowerCase().trim();
            return (
              linha.trim().length > 20 &&
              !linhaLower.includes("linkedin") &&
              !linhaLower.includes("entrar") &&
              !linhaLower.includes("nível de experiência") &&
              !linhaLower.includes("tipo de emprego") &&
              !linhaLower.includes("função") &&
              !linhaLower.includes("setores") &&
              !linhaLower.includes("assistente") &&
              !linhaLower.includes("tempo integral") &&
              !linhaLower.includes("tecnologia da informação") &&
              !linhaLower.includes("desenvolvimento de software")
            );
          });

          if (linhas.length > 5) {
            return linhas.join("\n\n");
          }
        }
      }

      return "Descrição não encontrada - não foi possível localizar a descrição completa da vaga";
    });

    // Se a descrição encontrada é muito curta ou parece ser apenas metadados, tenta novamente
    if (
      descricao.trim().length < 300 ||
      descricao.toLowerCase().includes("nível de experiência") ||
      descricao.toLowerCase().includes("tipo de emprego")
    ) {
      console.log(
        "  Descrição parece incompleta, tentando estratégia alternativa..."
      );

      // Aguarda mais um pouco e tenta novamente
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const descricaoAlternativa = await page.evaluate(() => {
        // Procura por qualquer elemento com muito texto que não seja navegação
        const todosElementos = Array.from(document.querySelectorAll("*"));
        for (let elemento of todosElementos) {
          const texto = (
            elemento.innerText ||
            elemento.textContent ||
            ""
          ).trim();
          if (texto.length > 500) {
            const textoLower = texto.toLowerCase();
            const temPalavrasChave =
              textoLower.includes("responsabilidade") ||
              textoLower.includes("atribuição") ||
              textoLower.includes("requisito") ||
              textoLower.includes("desejável") ||
              textoLower.includes("desenvolvimento");
            const naoTemMetadados =
              !textoLower.includes("nível de experiência") &&
              !textoLower.includes("tipo de emprego") &&
              !textoLower.includes("função") &&
              !textoLower.includes("setores");

            if (
              temPalavrasChave &&
              naoTemMetadados &&
              !textoLower.includes("linkedin")
            ) {
              return texto;
            }
          }
        }
        return null;
      });

      if (descricaoAlternativa && descricaoAlternativa.length > 300) {
        await page.close();
        return descricaoAlternativa.trim();
      }
    }

    await page.close();

    return descricao.trim();
  } catch (error) {
    console.error(`  Erro ao baixar descrição: ${error.message}`);
    return `Erro ao baixar descrição: ${error.message}`;
  }
}

/**
 * Gera um currículo ATS-friendly otimizado para uma vaga específica
 * @param {string} curriculoOriginal - Currículo original do usuário
 * @param {string} descricaoVaga - Descrição completa da vaga
 * @param {string} promptPersonalizado - Prompt personalizado do agente (opcional)
 * @returns {Promise<string>} Currículo otimizado
 */
async function gerarCurriculoATS(
  curriculoOriginal,
  descricaoVaga,
  promptPersonalizado = null
) {
  try {
    // Verifica se a API key está configurada
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY não configurada. Configure no arquivo .env"
      );
    }

    // Inicializa o cliente OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Prompt padrão para gerar currículo ATS-friendly
    // Se o usuário fornecer um prompt personalizado, usa ele
    const promptBase =
      promptPersonalizado ||
      `Você é um especialista em recrutamento e otimização de currículos para sistemas ATS (Applicant Tracking System).

Sua tarefa é criar um currículo ATS-friendly otimizado baseado no currículo original fornecido e na descrição da vaga.

INSTRUÇÕES IMPORTANTES:
1. Mantenha TODAS as informações verdadeiras do currículo original
2. Otimize palavras-chave e habilidades para corresponder à descrição da vaga
3. Use formatação simples e compatível com ATS (sem tabelas complexas, sem colunas, sem gráficos)
4. Organize as seções de forma clara e padronizada
5. Destaque experiências e habilidades relevantes para a vaga
6. Use palavras-chave da descrição da vaga quando apropriado
7. Mantenha o currículo profissional e objetivo
8. Garanta que o currículo seja facilmente parseável por sistemas ATS

CURRÍCULO ORIGINAL:
${curriculoOriginal}

DESCRIÇÃO DA VAGA:
${descricaoVaga}

Gere um currículo otimizado ATS-friendly que:
- Mantenha todas as informações verdadeiras do currículo original
- Destaque as habilidades e experiências mais relevantes para esta vaga específica
- Use palavras-chave da descrição da vaga de forma natural
- Seja formatado de forma compatível com sistemas ATS
- Mantenha a estrutura profissional e clara

Retorne APENAS o currículo otimizado, sem explicações adicionais.`;

    console.log("  Gerando currículo ATS-friendly...");

    const model = process.env.OPENAI_MODEL || "gpt-4";

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em otimização de currículos para sistemas ATS. Sempre mantenha a veracidade das informações e otimize para corresponder às vagas.",
        },
        {
          role: "user",
          content: promptBase,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const curriculoOtimizado = response.choices[0].message.content.trim();
    console.log("  ✓ Currículo gerado com sucesso!");

    return curriculoOtimizado;
  } catch (error) {
    console.error(`  Erro ao gerar currículo: ${error.message}`);
    throw error;
  }
}

/**
 * Salva o currículo otimizado em um arquivo TXT
 * @param {string} curriculoOtimizado - Currículo otimizado
 * @param {number} index - Índice da vaga
 * @param {string} link - Link da vaga
 */
async function salvarCurriculoOtimizado(curriculoOtimizado, index, link) {
  try {
    // Cria diretório de saída se não existir
    const outputDir = path.join(__dirname, "curriculos_otimizados");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Nome do arquivo baseado no índice
    const fileName = `curriculo_vaga_${index + 1}.txt`;
    const filePath = path.join(outputDir, fileName);

    // Cria documento DOCX
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `CURRÍCULO OTIMIZADO PARA VAGA ${index + 1}`,
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "=".repeat(80),
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `LINK DA VAGA: ${link}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `DATA DE GERAÇÃO: ${new Date().toLocaleString(
                    "pt-BR"
                  )}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "=".repeat(80),
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: curriculoOtimizado,
                  size: 24,
                }),
              ],
            }),
          ],
        },
      ],
    });

    // Salva o documento
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    console.log(`  ✓ Currículo otimizado salvo em: ${filePath}`);
  } catch (error) {
    console.error(`  Erro ao salvar currículo: ${error.message}`);
  }
}

/**
 * Salva a descrição da vaga em um arquivo TXT
 * @param {string} descricao - Descrição da vaga
 * @param {number} index - Índice da vaga
 * @param {string} link - Link da vaga
 */
async function salvarDescricaoEmTxt(descricao, index, link) {
  try {
    // Cria diretório de saída se não existir
    const outputDir = path.join(__dirname, "descricoes");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Nome do arquivo baseado no índice
    const fileName = `vaga_${index + 1}.txt`;
    const filePath = path.join(outputDir, fileName);

    // Conteúdo do arquivo
    const conteudo =
      `LINK DA VAGA: ${link}\n\n` +
      `DATA DE EXTRAÇÃO: ${new Date().toLocaleString("pt-BR")}\n\n` +
      `DESCRIÇÃO:\n${"=".repeat(80)}\n\n${descricao}\n`;

    fs.writeFileSync(filePath, conteudo, "utf-8");
    console.log(`  ✓ Descrição salva em: ${filePath}`);
  } catch (error) {
    console.error(`  Erro ao salvar arquivo: ${error.message}`);
  }
}

/**
 * Função principal
 */
async function main() {
  let browser = null;

  try {
    // Lê o arquivo de currículo
    const curriculoPath = path.join(__dirname, "curriculo.txt");
    console.log("Lendo arquivo de currículo...\n");
    const curriculo = await lerCurriculo(curriculoPath);
    console.log(curriculo);
    console.log("Currículo carregado com sucesso!");
    console.log(`Tamanho do currículo: ${curriculo.length} caracteres\n`);

    const csvPath = path.join(__dirname, "vagas.csv");
    console.log("Lendo arquivo CSV de vagas...\n");

    const vagas = await lerCSVVagas(csvPath);

    console.log(`Total de vagas encontradas: ${vagas.length}\n`);
    console.log("=== INICIANDO DOWNLOAD DAS DESCRIÇÕES ===\n");

    // Inicia o navegador Puppeteer
    console.log("Iniciando navegador...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Navegador iniciado.\n");

    // Processa cada vaga
    for (let i = 0; i < vagas.length; i++) {
      const vaga = vagas[i];
      const link = vaga.link || vaga.Link || vaga.url || vaga.URL;

      if (!link) {
        console.log(`Vaga ${i + 1}: Link não encontrado, pulando...\n`);
        continue;
      }

      console.log(`\n[${i + 1}/${vagas.length}] Processando vaga ${i + 1}:`);
      console.log(`  Link: ${link}`);

      // Baixa a descrição
      const descricao = await baixarDescricaoVaga(link, browser);

      // Salva em arquivo TXT
      await salvarDescricaoEmTxt(descricao, i, link);

      // Gera currículo otimizado se a descrição foi encontrada
      if (
        descricao &&
        descricao.length > 200 &&
        !descricao.includes("Descrição não encontrada")
      ) {
        try {
          // Lê o prompt personalizado se existir
          let promptPersonalizado = null;
          const promptPath = path.join(__dirname, "prompt_agente.txt");
          if (fs.existsSync(promptPath)) {
            promptPersonalizado = fs.readFileSync(promptPath, "utf-8").trim();
            console.log("  Usando prompt personalizado do agente");
          }

          const curriculoOtimizado = await gerarCurriculoATS(
            curriculo,
            descricao,
            promptPersonalizado
          );
          await salvarCurriculoOtimizado(curriculoOtimizado, i, link);
        } catch (error) {
          console.error(
            `  Erro ao gerar currículo otimizado: ${error.message}`
          );
          console.log("  Continuando para próxima vaga...");
        }
      } else {
        console.log(
          "  Descrição muito curta ou não encontrada, pulando geração de currículo"
        );
      }

      // Aguarda um pouco entre requisições para evitar bloqueios
      if (i < vagas.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log("\n=== PROCESSAMENTO CONCLUÍDO ===");
    console.log(`Total de vagas processadas: ${vagas.length}`);
    console.log(`Descrições salvas em: ${path.join(__dirname, "descricoes")}`);
    console.log(
      `Currículos otimizados salvos em: ${path.join(
        __dirname,
        "curriculos_otimizados"
      )}`
    );
  } catch (error) {
    console.error("Erro no processamento:", error.message);
    process.exit(1);
  } finally {
    // Fecha o navegador
    if (browser) {
      await browser.close();
      console.log("\nNavegador fechado.");
    }
  }
}

// Executa a função principal
main();
