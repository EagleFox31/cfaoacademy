/**
 * Remplace les blocs pt de privacy.js et delivery.js par des traductions PT complètes.
 */
import fs from 'node:fs'

const privacyPt = `  pt: {
    eyebrow: 'Dados pessoais',
    title: 'Política de privacidade',
    sub: 'Última atualização: junho de 2026 — CFAO Academy / CFAO Mobility Camarões',

    scopeTitle: 'Objeto e âmbito',
    scopeP1:
      'A presente política aplica-se ao site e à plataforma CFAO Academy, serviço de formação técnica da CFAO Mobility nos Camarões (filial do CFAO Group), concebido e explorado pela equipa CFAO Academy.',
    scopeP2: 'A CFAO Academy inclui:',
    scopeBullets: [
      'um LMS (Learning Management System) para percursos de aprendizes: inscrição em sessões, acesso a conteúdos, acompanhamento da progressão, avaliações e certificados;',
      'um módulo de assistência a formadores para o acompanhamento de pedidos de ajuda pedagógica ou logística emitidos por formadores ou coordenadores;',
      'uma ferramenta de reserva de salas e oficinas do centro de formação Academy (calendário, capacidade, equipamentos);',
      'o site público (catálogo, sessões, notícias, formulário de contacto).',
    ],
    scopeP3:
      'Descreve como os seus dados pessoais são recolhidos e tratados quando consulta o site, cria uma conta, segue uma formação, solicita assistência a um formador ou reserva uma sala no centro.',

    controllerTitle: 'Responsável pelo tratamento',
    controllerP1:
      'O responsável pelo tratamento é a CFAO Mobility, cuja sede social se situa em Bonabéri, Zona Industrial, Douala, Camarões.',
    controllerP2:
      'A CFAO Academy é o serviço operacional. Os tratamentos são realizados em conformidade com o quadro de proteção de dados do CFAO Group e a regulamentação aplicável (nomeadamente o RGPD para titulares situados no EEE e a legislação camaronesa em matéria de proteção de dados).',
    controllerContactLabel: 'Contacto operacional Academy:',
    controllerCompliance:
      'Para o exercício dos seus direitos em matéria de proteção de dados, pode também consultar as coordenadas do serviço Compliance / proteção de dados publicadas em',

    subjectsTitle: 'Titulares dos dados',
    subjectsBullets: [
      'Aprendizes — técnicos, conselheiros de serviço, gestores da rede CFAO',
      'Formadores — Key Instructors, Partner Instructor Managers, intervenientes de construtor',
      'Pessoal de filial / centro — coordenadores de formação, referentes de rede, administração do centro',
      'Visitantes do site — consulta do catálogo, pedidos via formulário de contacto',
    ],

    dataTitle: 'Dados recolhidos',
    dataIntro: 'Conforme a sua utilização da plataforma, podemos tratar:',
    dataBullets: [
      'Identificação e contacto — nome, apelido, identificador, endereço de e-mail profissional, número de telefone, filial CFAO, país, função',
      'Conta e autenticação — credenciais de acesso, histórico de sessões ativas, ligação SSO (Microsoft, Google) quando aplicável',
      'Percurso LMS — inscrições em sessões, presença, progressão, resultados de avaliações, certificados e certificações de construtor, materiais consultados',
      'Assistência a formadores — conteúdo dos pedidos de ajuda, trocas com a equipa Academy, estado do tratamento, anexos eventuais',
      'Reserva de salas — horários reservados, sala ou oficina em causa, sessão associada, número de participantes, necessidades materiais (equipamentos, veículos pedagógicos)',
      'Formulário de contacto — coordenadas, assunto e mensagem do seu pedido',
      'Navegação e preferências — registos técnicos (endereço IP, carimbo temporal), idioma de apresentação (FR/EN/PT), cookies ou armazenamento local estritamente necessários',
    ],
    dataOutro:
      'Os campos obrigatórios são indicados no momento da recolha. Alguns dados podem ser transmitidos pela sua filial ou referente de rede aquando da criação da sua conta de aprendiz.',

    tableTitle: 'Finalidades, bases legais e prazos de conservação',
    tableIntro:
      'A tabela abaixo resume os principais tratamentos. Os prazos indicativos podem ser prolongados em caso de obrigação legal, litígio ou arquivo justificado (certificações de construtor).',
    tablePurpose: 'Finalidade',
    tableLegal: 'Base legal',
    tableRetention: 'Prazo indicativo',

    processingRows: {
      lmsAccount: {
        purpose: 'Gestão da conta LMS',
        detail: 'criação, autenticação, direitos de acesso por perfil (aprendiz, formador, administrador)',
        legal: 'Execução do contrato / interesse legítimo',
        retention: 'Duração da conta + 3 anos',
      },
      trainingPath: {
        purpose: 'Percurso de formação',
        detail: 'inscrição, acompanhamento pedagógico, avaliações, emissão de certificados e certificações',
        legal: 'Execução do contrato',
        retention: 'Duração da formação + 10 anos (comprovativos profissionais)',
      },
      trainerSupport: {
        purpose: 'Assistência a formadores',
        detail: 'tratamento de pedidos de ajuda, coordenação com a equipa pedagógica e logística',
        legal: 'Interesse legítimo / execução do contrato',
        retention: '3 anos após encerramento do pedido',
      },
      roomBooking: {
        purpose: 'Reserva de salas',
        detail: 'planeamento de horários no centro de formação, atribuição de recursos (salas, oficinas, equipamentos)',
        legal: 'Execução do contrato / interesse legítimo',
        retention: '12 meses após a data da sessão',
      },
      contactForm: {
        purpose: 'Formulário de contacto',
        detail: 'resposta a pedidos (inscrição, catálogo, parceria, auditoria)',
        legal: 'Interesse legítimo / medidas pré-contratuais',
        retention: '3 anos após a última troca',
      },
      trainingComms: {
        purpose: 'Comunicações relacionadas com a formação',
        detail: 'convocatórias, lembretes de sessão, informações pedagógicas',
        legal: 'Execução do contrato',
        retention: 'Duração da relação de formação',
      },
      security: {
        purpose: 'Segurança e melhoria do serviço',
        detail: 'registos técnicos, prevenção de fraudes, manutenção da plataforma',
        legal: 'Interesse legítimo / obrigação legal',
        retention: '12 meses no máximo (registos)',
      },
      displayPrefs: {
        purpose: 'Preferências de apresentação',
        detail: 'idioma do site (FR/EN/PT)',
        legal: 'Interesse legítimo',
        retention: 'Enquanto não forem apagadas pelo utilizador',
      },
    },

    recipientsTitle: 'Destinatários dos dados',
    recipientsIntro: 'Os seus dados são acessíveis, no limite das respetivas atribuições, a:',
    recipientsBullets: [
      'a equipa CFAO Academy (pedagogia, planeamento, suporte)',
      'a sua filial CFAO e o seu referente de rede',
      'os formadores atribuídos às suas sessões ou ao seu pedido de assistência',
      'os construtores parceiros (Toyota, Mercedes-Benz, BYD, Suzuki, Stellantis, etc.) quando a certificação ou o programa o exige',
      'os subcontratantes técnicos (Microsoft Azure para alojamento, mensagens, autenticação SSO) vinculados por compromissos de confidencialidade e proteção de dados',
    ],
    recipientsOutro:
      'Nenhum dado pessoal é vendido a terceiros. Os acessos internos limitam-se ao princípio da necessidade de conhecimento (perfis aprendiz, formador, coordenador de centro, administrador).',

    transfersTitle: 'Transferências internacionais',
    transfersP1:
      'No âmbito das atividades do CFAO Group em África e, quando aplicável, com prestadores ou entidades situados fora dos Camarões ou do EEE, alguns dados podem ser objeto de transferências internacionais.',
    transfersP2:
      'Essas transferências são enquadradas por garantias adequadas (cláusulas contratuais-tipo, decisões de adequação ou medidas equivalentes) em conformidade com o quadro do CFAO Group e a regulamentação aplicável.',

    rightsTitle: 'Os seus direitos',
    rightsIntro:
      'Em conformidade com a regulamentação aplicável, dispõe dos seguintes direitos sobre os seus dados pessoais:',
    rightsBullets: [
      'Direito de acesso — obter uma cópia dos seus dados',
      'Direito de retificação — corrigir dados inexatos ou incompletos',
      'Direito ao apagamento — nas condições previstas pela lei',
      'Direito à limitação — restringir certos tratamentos',
      'Direito de oposição — nomeadamente a tratamentos baseados no interesse legítimo',
      'Direito à portabilidade — receber os seus dados num formato estruturado, quando aplicável',
      'Retirada do consentimento — quando o tratamento se baseia no seu consentimento',
    ],
    rightsExerciseBefore: 'Para exercer os seus direitos, contacte',
    rightsExerciseAfter:
      'indicando o assunto do seu pedido. Poderá ser solicitado um documento de identificação para verificar a sua identidade.',
    rightsComplaint:
      'Pode também apresentar uma reclamação junto da autoridade de proteção de dados competente (autoridade camaronesa ou, quando aplicável, a autoridade do seu país de residência, incluindo ao abrigo do RGPD).',

    cookiesTitle: 'Cookies e armazenamento local',
    cookiesIntro: 'A plataforma utiliza nomeadamente:',
    cookiesBullets: [
      'Cookies de sessão — manutenção da ligação segura ao LMS e aos módulos de reserva / assistência',
      'Armazenamento de preferências — idioma selecionado (FR/EN/PT) registado localmente no seu navegador',
      'Cookies técnicos — segurança, equilíbrio de carga, memorização de navegação interna (ex.: regresso ao calendário de sessões)',
    ],
    cookiesOutro:
      'Ferramentas de medição de audiência podem ser implementadas posteriormente; nesse caso, o seu consentimento será recolhido em conformidade com o quadro de cookies do CFAO Group. Pode gerir os cookies a qualquer momento nas definições do seu navegador.',

    securityTitle: 'Segurança',
    securityP1:
      'A CFAO Mobility implementa medidas técnicas e organizacionais adequadas ao LMS e aos dados de formação: comunicações encriptadas (HTTPS), gestão de permissões por perfil, cópias de segurança, controlo de acesso aos módulos de formadores e reserva, e sensibilização do pessoal autorizado.',

    updatesTitle: 'Alterações',
    updatesP1:
      'Esta política pode ser atualizada para refletir a evolução dos serviços CFAO Academy (LMS, assistência a formadores, reserva de salas) ou os requisitos regulamentares do CFAO Group. Em caso de alteração substancial, os utilizadores autenticados poderão ser informados por e-mail ou notificação na plataforma.',

    contactTitle: 'Contacto',
    contactP1Before:
      'Para qualquer questão relativa a esta política ou ao tratamento dos seus dados no âmbito da CFAO Academy:',
    closeAria: 'Fechar e voltar à página anterior',
  },`

const deliveryPt = `  pt: {
    page_eyebrow: 'App 15',
    page_title: 'Gestão de projeto',
    page_lead:
      'Roadmap, backlog, gate go-live e reporting MOA — acompanhamento da construção da plataforma CFAO Academy.',
    section_ix: '15',
    section_title_before: 'Gestão de ',
    section_title_em: 'projeto',
    section_title_after: '.',
    back_portal: 'O meu portail',
    tab_overview: 'Visão geral',
    tab_backlog: 'Backlog',
    tab_gate: 'Gate go-live',
    tab_reporting: 'Reporting MOA',
    tab_git: 'Atividade Git',
    read_only_banner: 'Vista só de leitura — reservada ao comité de pilotagem.',
    kpi_stories_done: 'Stories concluídas',
    kpi_in_progress: 'Em curso',
    kpi_in_progress_meta: 'Stories ativas esta semana',
    kpi_gate: 'Gate go-live',
    kpi_critical_te: 'TE caminho crítico',
    kpi_critical_te_value: '20,3 sem.',
    section_roadmap: 'Planeamento PERT (v2)',
    section_roadmap_sub: 'Caminho crítico release 1 : A → B → C → D → M → J',
    pert_critical: 'Crítico R1',
    pert_parallel: 'Paralelo',
    phase_0: 'Fase 0 — Plataforma',
    phase_1: 'Fase 1 — MVP portail',
    phase_1bis: 'Fase 1 bis — CMS',
    phase_2: 'Fase 2 — Recrutamento',
    phase_1_1: 'Fase 1.1 — Analytics e notificações',
    phase_release: 'Release — Gate J',
    epic_00: 'Migração e inicialização',
    epic_01: 'Site público',
    epic_02: 'Espaço apprenant',
    epic_08: 'Gestão de sessões',
    epic_09: 'Recrutamento',
    epic_14: 'Notificações',
    epic_15: 'Gestão de projeto',
    story_00_1: 'Inicializar a estrutura organizacional',
    story_00_4: 'Migrar catálogo e sessões',
    story_00_7: 'Smoke tests pós-migração por perfil',
    story_00_8: 'Gate go-live (checklist + rollback)',
    story_02_1: 'Consultar o meu percurso de formação',
    story_08_1: 'Criar e modificar sessões',
    story_15_1: 'Visualizar a roadmap e o PERT',
    story_15_2: 'Sincronizar o estado das stories',
    story_15_9: 'Relatório formal MOA semanal',
    story_t_1: 'Ligação SSO Keycloak',
    filter_all_epics: 'Todos os epics',
    filter_all_status: 'Todos os estados',
    filter_label: 'Filtrar',
    col_story: 'Story',
    col_status: 'Estado',
    col_tests: 'Testes',
    status_todo: 'Por fazer',
    status_in_progress: 'Em curso',
    status_done: 'Concluído',
    status_blocked: 'Bloqueado',
    test_tu: 'TU',
    test_ti: 'TI',
    test_contract: 'Contrato',
    test_e2e: 'E2E',
    test_pending: '—',
    test_done: 'OK',
    test_na: 'N/A',
    gate_title: 'Checklist gate J',
    gate_sub: 'Sem acesso de utilizador real sem validação explícita.',
    gate_done: 'Validado',
    gate_pending: 'Pendente',
    gate_done_meta: 'Critério satisfeito para a gate J',
    gate_pending_meta: 'A validar antes da abertura em produção',
    gate_toggle_hint: 'Marcar / desmarcar',
    gate_g1: '00-5 — Lotes migrados validados (org, contas, catálogo)',
    gate_g2: '00-7 — Smoke E2E verde por perfil R1',
    gate_g3: 'Caminho A→B→C→D entregue (QCM + percurso mínimo)',
    gate_g4: 'Webhook E→D testado (se sessões R1)',
    gate_g5: 'Suite TU→TI→contrato→E2E verde no âmbito R1',
    gate_g6: 'Cópia de segurança e restauro documentados',
    gate_g7: 'Sem abertura em produção sem J assinada',
    gate_g8: 'Documentação de planeamento e arquitetura atualizada',
    reporting_schedule: 'Calendário de e-mails',
    reporting_reminder: 'Lembrete para developers',
    reporting_moa: 'Relatório MOA',
    day_thursday: 'Quinta-feira',
    day_friday: 'Sexta-feira',
    recipients: 'Destinatários MOA',
    digest_history: 'Histórico de relatórios',
    digest_preview: 'Pré-visualização do próximo relatório',
    digest_status_sent: 'Enviado',
    digest_status_draft: 'Rascunho',
    digest_validate: 'Validar rascunho',
    digest_send: 'Enviar agora',
    digest_validated: 'Rascunho validado para envio automático na sexta-feira.',
    git_config: 'Ligação repositório Git',
    git_provider: 'Fornecedor',
    git_repo: 'Repositório',
    git_webhook: 'Webhook',
    git_connected: 'Ligado',
    git_disconnected: 'Não ligado',
    git_connect: 'Configurar',
    commits_week: 'Commits recentes',
    weekly_status: 'Estado semanal em curso',
    weekly_avancements: 'Avanços',
    weekly_objectifs: 'Objetivos em curso',
    weekly_next: 'Objetivos para a próxima semana',
    weekly_goulots: 'Gargalos',
    contributing_hint: 'Convenções de commits — ver CONTRIBUTING.md na raiz do repositório.',
    digest_preview_w22:
      'Exmo(a). Sr(a),\\n\\nTemos o prazer de apresentar o relatório de progresso do projeto CFAO Academy para a semana de 26 a 30 de maio de 2026.\\n\\nOs trabalhos de planeamento (PERT v2) e de enquadramento dos papéis foram concluídos. A documentação de arquitetura está alinhada com o âmbito da release 1.\\n\\nObjetivos em curso: preparação da infraestrutura Docker e da base de autenticação.\\n\\nObjetivos para a próxima semana: arranque do nó A (infra + CI) e implementação das convenções de reporting Git.\\n\\nPonto de atenção: finalização do ambiente de staging e do repositório Git.\\n\\nCom os melhores cumprimentos,\\nEquipa CFAO Academy',
    superadmin_link_title: 'Gestão de projeto',
    superadmin_link_desc: 'Roadmap, backlog, gate go-live e relatórios MOA',
    superadmin_link_cta: 'Abrir gestor de projeto →',
  },`

function patchPtBlock(filePath, exportMarker, newPtBlock) {
  let text = fs.readFileSync(filePath, 'utf8')
  const re = /\n  pt: \{[\s\S]*?\n  \},\n\}/
  if (!re.test(text)) {
    console.warn(`skip ${filePath} — pt block not found`)
    return
  }
  text = text.replace(re, `\n${newPtBlock}\n}`)
  fs.writeFileSync(filePath, text)
  console.log(`updated ${filePath}`)
}

patchPtBlock('src/i18n/privacy.js', 'PRIVACY_COPY', privacyPt)
patchPtBlock('src/i18n/delivery.js', 'DELIVERY_COPY', deliveryPt)
