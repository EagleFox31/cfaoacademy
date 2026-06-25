export const PROCESSING_ROW_IDS = [
  'lmsAccount',
  'trainingPath',
  'trainerSupport',
  'roomBooking',
  'contactForm',
  'trainingComms',
  'security',
  'displayPrefs',
]

export const PRIVACY_COPY = {
  fr: {
    eyebrow: 'Données personnelles',
    title: 'Politique de confidentialité',
    sub: 'Dernière mise à jour : juin 2026 — CFAO Academy / CFAO Mobility Cameroun',

    scopeTitle: 'Objet et périmètre',
    scopeP1:
      'La présente politique s’applique au site et à la plateforme CFAO Academy, service de formation technique de CFAO Mobility au Cameroun (filiale du CFAO Group), conçu et exploité par l’équipe CFAO Academy.',
    scopeP2: 'CFAO Academy regroupe :',
    scopeBullets: [
      'un LMS (Learning Management System) pour les parcours apprenants : inscription aux sessions, accès aux contenus, suivi de progression, évaluations et attestations ;',
      'un module d’assistance formateurs pour le suivi des demandes d’aide pédagogique ou logistique émises par les formateurs ou coordinateurs ;',
      'un outil de réservation des salles et ateliers du centre de formation Academy (planning, capacité, équipements) ;',
      'le site public (catalogue, sessions, actualités, formulaire de contact).',
    ],
    scopeP3:
      'Elle décrit comment vos données personnelles sont collectées et traitées lorsque vous consultez le site, créez un compte, suivez une formation, sollicitez un formateur ou réservez une salle au centre.',

    controllerTitle: 'Responsable du traitement',
    controllerP1:
      'Le responsable du traitement est CFAO Mobility, dont le siège social est situé à Bonabéri, Zone Industrielle, Douala, Cameroun.',
    controllerP2:
      'CFAO Academy en est le service opérationnel. Les traitements sont réalisés conformément au cadre de protection des données du CFAO Group et à la réglementation applicable (notamment le RGPD pour les personnes concernées situées dans l’EEE, et la législation camerounaise en matière de protection des données).',
    controllerContactLabel: 'Contact opérationnel Academy :',
    controllerCompliance:
      'Pour l’exercice de vos droits en matière de protection des données, vous pouvez également vous référer aux coordonnées du service Compliance / protection des données publiées sur',

    subjectsTitle: 'Personnes concernées',
    subjectsBullets: [
      'Apprenants — techniciens, conseillers service, managers réseau CFAO',
      'Formateurs — Key Instructors, Partner Instructor Managers, intervenants constructeur',
      'Personnel filiale / centre — coordinateurs formation, référents réseau, administration du centre',
      'Visiteurs du site — consultation du catalogue, demandes via le formulaire de contact',
    ],

    dataTitle: 'Données collectées',
    dataIntro: 'Selon votre usage de la plateforme, nous pouvons traiter :',
    dataBullets: [
      'Identification et contact — nom, prénom, identifiant, adresse e-mail professionnelle, numéro de téléphone, filiale CFAO, pays, fonction',
      'Compte et authentification — identifiants de connexion, historique de sessions actives, connexion SSO (Microsoft, Google) le cas échéant',
      'Parcours LMS — inscriptions aux sessions, présence, progression, résultats d’évaluations, attestations et certifications constructeur, supports consultés',
      'Assistance formateurs — contenu des demandes d’aide, échanges avec l’équipe Academy, statut de traitement, pièces jointes éventuelles',
      'Réservation de salles — créneaux réservés, salle ou atelier concerné, session associée, nombre de participants, besoins matériels (équipements, véhicules pédagogiques)',
      'Formulaire de contact — coordonnées, objet et message de votre demande',
      'Navigation et préférences — journaux techniques (adresse IP, horodatage), langue d’affichage (FR/EN), cookies ou stockages locaux strictement nécessaires',
    ],
    dataOutro:
      'Les champs obligatoires sont indiqués lors de la collecte. Certaines données peuvent être transmises par votre filiale ou référent réseau lors de la création de votre compte apprenant.',

    tableTitle: 'Finalités, bases légales et durées de conservation',
    tableIntro:
      'Le tableau ci-dessous résume les principaux traitements. Les durées indicatives peuvent être prolongées en cas d’obligation légale, de contentieux ou d’archivage justifié (certifications constructeur).',
    tablePurpose: 'Finalité',
    tableLegal: 'Base légale',
    tableRetention: 'Durée indicative',

    processingRows: {
      lmsAccount: {
        purpose: 'Gestion du compte LMS',
        detail: 'création, authentification, droits d’accès par profil (apprenant, formateur, administrateur)',
        legal: 'Exécution du contrat / intérêt légitime',
        retention: 'Durée du compte + 3 ans',
      },
      trainingPath: {
        purpose: 'Parcours de formation',
        detail: 'inscription, suivi pédagogique, évaluations, délivrance d’attestations et certifications',
        legal: 'Exécution du contrat',
        retention: 'Durée de la formation + 10 ans (justificatifs professionnels)',
      },
      trainerSupport: {
        purpose: 'Assistance formateurs',
        detail: 'traitement des demandes d’aide, coordination avec l’équipe pédagogique et logistique',
        legal: 'Intérêt légitime / exécution du contrat',
        retention: '3 ans après clôture de la demande',
      },
      roomBooking: {
        purpose: 'Réservation de salles',
        detail: 'planification des créneaux au centre de formation, affectation des ressources (salles, ateliers, équipements)',
        legal: 'Exécution du contrat / intérêt légitime',
        retention: '12 mois après la date de la session',
      },
      contactForm: {
        purpose: 'Formulaire de contact',
        detail: 'réponse aux demandes (inscription, catalogue, partenariat, audit)',
        legal: 'Intérêt légitime / mesures précontractuelles',
        retention: '3 ans après le dernier échange',
      },
      trainingComms: {
        purpose: 'Communications liées à la formation',
        detail: 'convocations, rappels de session, informations pédagogiques',
        legal: 'Exécution du contrat',
        retention: 'Durée de la relation de formation',
      },
      security: {
        purpose: 'Sécurité et amélioration du service',
        detail: 'journaux techniques, prévention des fraudes, maintenance de la plateforme',
        legal: 'Intérêt légitime / obligation légale',
        retention: '12 mois maximum (journaux)',
      },
      displayPrefs: {
        purpose: 'Préférences d’affichage',
        detail: 'langue du site (FR/EN)',
        legal: 'Intérêt légitime',
        retention: 'Tant que non effacées par l’utilisateur',
      },
    },

    recipientsTitle: 'Destinataires des données',
    recipientsIntro: 'Vos données sont accessibles, dans la limite de leurs attributions, à :',
    recipientsBullets: [
      'l’équipe CFAO Academy (pédagogie, planification, support)',
      'votre filiale CFAO et votre référent réseau',
      'les formateurs assignés à vos sessions ou à votre demande d’assistance',
      'les constructeurs partenaires (Toyota, Mercedes-Benz, BYD, Suzuki, Stellantis, etc.) lorsque la certification ou le programme l’exige',
      'les sous-traitants techniques (Microsoft Azure pour l’hébergement, messagerie, authentification SSO) liés par des engagements de confidentialité et de protection des données',
    ],
    recipientsOutro:
      'Aucune donnée personnelle n’est vendue à des tiers. Les accès internes sont limités au principe du besoin d’en connaître (profils apprenant, formateur, coordinateur centre, administrateur).',

    transfersTitle: 'Transferts internationaux',
    transfersP1:
      'Dans le cadre des activités du CFAO Group en Afrique et, le cas échéant, avec des prestataires ou entités situés en dehors du Cameroun ou de l’EEE, certaines données peuvent faire l’objet de transferts internationaux.',
    transfersP2:
      'Ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types, décisions d’adéquation ou mesures équivalentes) conformément au cadre du CFAO Group et à la réglementation applicable.',

    rightsTitle: 'Vos droits',
    rightsIntro:
      'Conformément à la réglementation applicable, vous disposez des droits suivants sur vos données personnelles :',
    rightsBullets: [
      'Droit d’accès — obtenir une copie de vos données',
      'Droit de rectification — corriger des données inexactes ou incomplètes',
      'Droit à l’effacement — dans les conditions prévues par la loi',
      'Droit à la limitation — restreindre certains traitements',
      'Droit d’opposition — notamment aux traitements fondés sur l’intérêt légitime',
      'Droit à la portabilité — recevoir vos données dans un format structuré, lorsque applicable',
      'Retrait du consentement — lorsque le traitement repose sur votre consentement',
    ],
    rightsExerciseBefore: 'Pour exercer vos droits, contactez',
    rightsExerciseAfter:
      'en précisant l’objet de votre demande. Une pièce d’identité pourra être demandée afin de vérifier votre identité.',
    rightsComplaint:
      'Vous pouvez également introduire une réclamation auprès de l’autorité de protection des données compétente (autorité camerounaise ou, le cas échéant, autorité de votre pays de résidence, notamment en application du RGPD).',

    cookiesTitle: 'Cookies et stockages locaux',
    cookiesIntro: 'La plateforme utilise notamment :',
    cookiesBullets: [
      'Cookies de session — maintien de la connexion sécurisée au LMS et aux modules réservation / assistance',
      'Stockage de préférence — langue sélectionnée (FR/EN) enregistrée localement dans votre navigateur',
      'Cookies techniques — sécurité, équilibrage de charge, mémorisation de navigation interne (ex. retour au planning sessions)',
    ],
    cookiesOutro:
      'Des outils de mesure d’audience peuvent être déployés ultérieurement ; le cas échéant, votre consentement sera recueilli conformément au cadre cookies du CFAO Group. Vous pouvez à tout moment gérer les cookies via les paramètres de votre navigateur.',

    securityTitle: 'Sécurité',
    securityP1:
      'CFAO Mobility met en œuvre des mesures techniques et organisationnelles adaptées au LMS et aux données de formation : chiffrement des communications (HTTPS), gestion des habilitations par profil, sauvegardes, contrôle d’accès aux modules formateurs et réservation, et sensibilisation du personnel autorisé.',

    updatesTitle: 'Modifications',
    updatesP1:
      'Cette politique peut être mise à jour pour refléter l’évolution des services CFAO Academy (LMS, assistance formateurs, réservation de salles) ou des exigences réglementaires du CFAO Group. En cas de modification substantielle, les utilisateurs connectés pourront être informés par e-mail ou notification sur la plateforme.',

    contactTitle: 'Contact',
    contactP1Before:
      'Pour toute question relative à cette politique ou au traitement de vos données dans le cadre de CFAO Academy :',
    closeAria: 'Fermer et revenir à la page précédente',
  },

  en: {
    eyebrow: 'Personal data',
    title: 'Privacy policy',
    sub: 'Last updated: June 2026 — CFAO Academy / CFAO Mobility Cameroon',

    scopeTitle: 'Purpose and scope',
    scopeP1:
      'This policy applies to the CFAO Academy website and platform, a CFAO Mobility technical training service in Cameroon (CFAO Group subsidiary), designed and operated by the CFAO Academy team.',
    scopeP2: 'CFAO Academy includes:',
    scopeBullets: [
      'an LMS (Learning Management System) for learner journeys: session registration, content access, progress tracking, assessments and certificates;',
      'a trainer support module for pedagogical or logistical assistance requests from trainers or coordinators;',
      'a training centre room and workshop booking tool (scheduling, capacity, equipment);',
      'the public website (catalogue, sessions, news, contact form).',
    ],
    scopeP3:
      'It describes how your personal data is collected and processed when you browse the site, create an account, follow training, request trainer support or book a room at the centre.',

    controllerTitle: 'Data controller',
    controllerP1:
      'The data controller is CFAO Mobility, whose registered office is in Bonabéri, Industrial Zone, Douala, Cameroon.',
    controllerP2:
      'CFAO Academy is the operational service. Processing is carried out in line with CFAO Group data protection standards and applicable law (including the GDPR for data subjects in the EEA, and Cameroonian data protection legislation).',
    controllerContactLabel: 'Academy operational contact:',
    controllerCompliance:
      'To exercise your data protection rights, you may also refer to the Compliance / data protection contact details published on',

    subjectsTitle: 'Data subjects',
    subjectsBullets: [
      'Learners — technicians, service advisors, CFAO network managers',
      'Trainers — Key Instructors, Partner Instructor Managers, manufacturer instructors',
      'Branch / centre staff — training coordinators, network contacts, centre administration',
      'Website visitors — catalogue browsing, requests via the contact form',
    ],

    dataTitle: 'Data collected',
    dataIntro: 'Depending on how you use the platform, we may process:',
    dataBullets: [
      'Identification and contact — name, user ID, work email, phone number, CFAO branch, country, job title',
      'Account and authentication — login credentials, active session history, SSO sign-in (Microsoft, Google) where applicable',
      'LMS journey — session registrations, attendance, progress, assessment results, manufacturer certificates, content viewed',
      'Trainer support — support request content, exchanges with the Academy team, processing status, attachments where provided',
      'Room booking — booked time slots, room or workshop, linked session, number of participants, equipment needs (tools, training vehicles)',
      'Contact form — contact details, subject and message of your request',
      'Browsing and preferences — technical logs (IP address, timestamps), display language (FR/EN), strictly necessary cookies or local storage',
    ],
    dataOutro:
      'Mandatory fields are indicated at collection. Some data may be provided by your branch or network contact when your learner account is created.',

    tableTitle: 'Purposes, legal bases and retention',
    tableIntro:
      'The table below summarises the main processing activities. Indicative retention periods may be extended where required by law, litigation or justified archiving (manufacturer certifications).',
    tablePurpose: 'Purpose',
    tableLegal: 'Legal basis',
    tableRetention: 'Indicative retention',

    processingRows: {
      lmsAccount: {
        purpose: 'LMS account management',
        detail: 'creation, authentication, role-based access (learner, trainer, administrator)',
        legal: 'Contract performance / legitimate interest',
        retention: 'Account lifetime + 3 years',
      },
      trainingPath: {
        purpose: 'Training journey',
        detail: 'registration, learning follow-up, assessments, certificates and certifications',
        legal: 'Contract performance',
        retention: 'Training duration + 10 years (professional records)',
      },
      trainerSupport: {
        purpose: 'Trainer support',
        detail: 'handling assistance requests, coordination with pedagogical and logistics teams',
        legal: 'Legitimate interest / contract performance',
        retention: '3 years after the request is closed',
      },
      roomBooking: {
        purpose: 'Room booking',
        detail: 'scheduling at the training centre, allocation of resources (rooms, workshops, equipment)',
        legal: 'Contract performance / legitimate interest',
        retention: '12 months after the session date',
      },
      contactForm: {
        purpose: 'Contact form',
        detail: 'responding to requests (registration, catalogue, partnership, audit)',
        legal: 'Legitimate interest / pre-contractual steps',
        retention: '3 years after the last exchange',
      },
      trainingComms: {
        purpose: 'Training-related communications',
        detail: 'invitations, session reminders, learning information',
        legal: 'Contract performance',
        retention: 'Duration of the training relationship',
      },
      security: {
        purpose: 'Security and service improvement',
        detail: 'technical logs, fraud prevention, platform maintenance',
        legal: 'Legitimate interest / legal obligation',
        retention: '12 months maximum (logs)',
      },
      displayPrefs: {
        purpose: 'Display preferences',
        detail: 'site language (FR/EN)',
        legal: 'Legitimate interest',
        retention: 'Until cleared by the user',
      },
    },

    recipientsTitle: 'Data recipients',
    recipientsIntro: 'Your data is accessible, within their remit, to:',
    recipientsBullets: [
      'the CFAO Academy team (learning, scheduling, support)',
      'your CFAO branch and network contact',
      'trainers assigned to your sessions or support request',
      'partner manufacturers (Toyota, Mercedes-Benz, BYD, Suzuki, Stellantis, etc.) where certification or the programme requires it',
      'technical subprocessors (Microsoft Azure for hosting, email, SSO authentication) bound by confidentiality and data protection commitments',
    ],
    recipientsOutro:
      'No personal data is sold to third parties. Internal access is limited on a need-to-know basis (learner, trainer, centre coordinator, administrator profiles).',

    transfersTitle: 'International transfers',
    transfersP1:
      'As part of CFAO Group activities in Africa and, where applicable, with providers or entities outside Cameroon or the EEA, some data may be transferred internationally.',
    transfersP2:
      'Such transfers are governed by appropriate safeguards (standard contractual clauses, adequacy decisions or equivalent measures) in line with CFAO Group standards and applicable law.',

    rightsTitle: 'Your rights',
    rightsIntro:
      'Under applicable law, you have the following rights regarding your personal data:',
    rightsBullets: [
      'Right of access — obtain a copy of your data',
      'Right to rectification — correct inaccurate or incomplete data',
      'Right to erasure — under the conditions provided by law',
      'Right to restriction — limit certain processing',
      'Right to object — notably to processing based on legitimate interest',
      'Right to data portability — receive your data in a structured format, where applicable',
      'Withdrawal of consent — where processing is based on your consent',
    ],
    rightsExerciseBefore: 'To exercise your rights, contact',
    rightsExerciseAfter:
      'stating the subject of your request. Proof of identity may be required for verification.',
    rightsComplaint:
      'You may also lodge a complaint with the competent data protection authority (Cameroonian authority or, where applicable, the authority in your country of residence, including under the GDPR).',

    cookiesTitle: 'Cookies and local storage',
    cookiesIntro: 'The platform uses in particular:',
    cookiesBullets: [
      'Session cookies — secure sign-in to the LMS and booking / support modules',
      'Preference storage — selected language (FR/EN) stored locally in your browser',
      'Technical cookies — security, load balancing, internal navigation (e.g. return to session schedule)',
    ],
    cookiesOutro:
      'Audience measurement tools may be deployed later; if so, your consent will be collected in line with CFAO Group cookie standards. You can manage cookies at any time in your browser settings.',

    securityTitle: 'Security',
    securityP1:
      'CFAO Mobility implements technical and organisational measures suited to the LMS and training data: encrypted communications (HTTPS), role-based access, backups, access control for trainer and booking modules, and awareness for authorised staff.',

    updatesTitle: 'Changes',
    updatesP1:
      'This policy may be updated to reflect changes to CFAO Academy services (LMS, trainer support, room booking) or CFAO Group regulatory requirements. In the event of a material change, signed-in users may be notified by email or in-platform message.',

    contactTitle: 'Contact',
    contactP1Before:
      'For any question about this policy or the processing of your data within CFAO Academy:',
    closeAria: 'Close and return to the previous page',
  },
  pt: {
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
  },
}
