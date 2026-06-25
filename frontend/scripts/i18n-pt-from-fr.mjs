/**
 * Régénère les blocs pt à partir de fr pour legal, privacy, delivery.
 * Usage: node scripts/i18n-pt-from-fr.mjs
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const FR_PT = [
  ['Madame, Monsieur', 'Exmo(a). Sr(a)'],
  ['Nous avons le plaisir de vous présenter', 'Temos o prazer de apresentar'],
  ['point d’avancement', 'relatório de progresso'],
  ['semaine du', 'semana de'],
  ['semaine prochaine', 'próxima semana'],
  ['Objectifs en cours', 'Objetivos em curso'],
  ['Objectifs semaine prochaine', 'Objetivos para a próxima semana'],
  ['Point de vigilance', 'Ponto de atenção'],
  ['Cordialement', 'Com os melhores cumprimentos'],
  ['Équipe CFAO Academy', 'Equipa CFAO Academy'],
  ['Informations légales', 'Informação legal'],
  ['Mentions légales', 'Informação legal'],
  ['Dernière mise à jour', 'Última atualização'],
  ['Fermer et revenir à la page précédente', 'Fechar e voltar à página anterior'],
  ['Éditeur du site', 'Editor do site'],
  ['Conception et développement', 'Conceção e desenvolvimento'],
  ['Nature du site', 'Natureza do site'],
  ['Hébergement', 'Alojamento'],
  ['Propriété intellectuelle', 'Propriedade intelectual'],
  ['Marques et logos', 'Marcas e logótipos'],
  ['Conception & crédits', 'Conceção e créditos'],
  ['Limitation de responsabilité', 'Limitação de responsabilidade'],
  ['Liens hypertextes et cookies', 'Hiperligações e cookies'],
  ['Droit applicable', 'Direito aplicável'],
  ['Contact', 'Contacto'],
  ['Tous droits réservés', 'Todos os direitos reservados'],
  ['politique de confidentialité', 'política de privacidade'],
  ['Données personnelles', 'Dados pessoais'],
  ['Politique de confidentialité', 'Política de privacidade'],
  ['Objet et périmètre', 'Objeto e âmbito'],
  ['Responsable du traitement', 'Responsável pelo tratamento'],
  ['Personnes concernées', 'Titulares dos dados'],
  ['Données collectées', 'Dados recolhidos'],
  ['Finalités, bases légales et durées de conservation', 'Finalidades, bases legais e prazos de conservação'],
  ['Finalité', 'Finalidade'],
  ['Base légale', 'Base legal'],
  ['Durée indicative', 'Prazo indicativo'],
  ['Destinataires des données', 'Destinatários dos dados'],
  ['Transferts internationaux', 'Transferências internacionais'],
  ['Vos droits', 'Os seus direitos'],
  ['Cookies et stockages locaux', 'Cookies e armazenamento local'],
  ['Sécurité', 'Segurança'],
  ['Modifications', 'Alterações'],
  ['Pilotage projet', 'Gestão de projeto'],
  ['Mon portail', 'O meu portail'],
  ['Vue d’ensemble', 'Visão geral'],
  ['Gate go-live', 'Gate go-live'],
  ['Reporting MOA', 'Reporting MOA'],
  ['Activité Git', 'Atividade Git'],
  ['Vue lecture seule', 'Vista só de leitura'],
  ['Stories terminées', 'Stories concluídas'],
  ['En cours', 'Em curso'],
  ['Stories actives cette semaine', 'Stories ativas esta semana'],
  ['TE chemin critique', 'TE caminho crítico'],
  ['sem.', 'sem.'],
  ['Planification PERT (v2)', 'Planeamento PERT (v2)'],
  ['Chemin critique release 1', 'Caminho crítico release 1'],
  ['Critique R1', 'Crítico R1'],
  ['Parallèle', 'Paralelo'],
  ['Phase 0 — Plateforme', 'Fase 0 — Plataforma'],
  ['Phase 1 — MVP portail', 'Fase 1 — MVP portail'],
  ['Phase 1 bis — CMS', 'Fase 1 bis — CMS'],
  ['Phase 2 — Recrutement', 'Fase 2 — Recrutamento'],
  ['Phase 1.1 — Analytics & notifs', 'Fase 1.1 — Analytics e notificações'],
  ['Release — Gate J', 'Release — Gate J'],
  ['Migration & initialisation', 'Migração e inicialização'],
  ['Site public', 'Site público'],
  ['Espace apprenant', 'Espaço apprenant'],
  ['Gestion des sessions', 'Gestão de sessões'],
  ['Recrutement', 'Recrutamento'],
  ['Notifications', 'Notificações'],
  ['À faire', 'Por fazer'],
  ['Terminé', 'Concluído'],
  ['Bloqué', 'Bloqueado'],
  ['Checklist gate J', 'Checklist gate J'],
  ['Validé', 'Validado'],
  ['En attente', 'Pendente'],
  ['Cocher / décocher', 'Marcar / desmarcar'],
  ['Calendrier emails', 'Calendário de e-mails'],
  ['Rappel développeurs', 'Lembrete developers'],
  ['Rapport MOA', 'Relatório MOA'],
  ['Jeudi', 'Quinta-feira'],
  ['Vendredi', 'Sexta-feira'],
  ['Destinataires MOA', 'Destinatários MOA'],
  ['Historique des rapports', 'Histórico de relatórios'],
  ['Aperçu prochain rapport', 'Pré-visualização do próximo relatório'],
  ['Envoyé', 'Enviado'],
  ['Brouillon', 'Rascunho'],
  ['Valider le brouillon', 'Validar rascunho'],
  ['Envoyer maintenant', 'Enviar agora'],
  ['Connexion dépôt Git', 'Ligação repositório Git'],
  ['Fournisseur', 'Fornecedor'],
  ['Dépôt', 'Repositório'],
  ['Connecté', 'Ligado'],
  ['Non connecté', 'Não ligado'],
  ['Configurer', 'Configurar'],
  ['Commits récents', 'Commits recentes'],
  ['Statut hebdo en cours', 'Estado semanal em curso'],
  ['Avancements', 'Avanços'],
  ['Objectifs en cours', 'Objetivos em curso'],
  ['Objectifs semaine prochaine', 'Objetivos para a próxima semana'],
  ['Goulots d’étranglement', 'Gargalos'],
  ['Ouvrir le gestionnaire', 'Abrir gestor de projeto'],
  ['Cameroun', 'Camarões'],
  ['camerounais', 'camaroonês'],
  ['française et anglaise', 'francesa e inglesa'],
  ['apprenants', 'aprendizes'],
  ['formateurs', 'formadores'],
  ['filiales', 'filiais'],
  ['visiteurs', 'visitantes'],
  ['formations', 'formações'],
  ['sessions', 'sessões'],
  ['actualités', 'notícias'],
  ['catalogue', 'catálogo'],
  ['attestations', 'attestations'],
  ['certifications', 'certificações'],
  ['constructeurs', 'construtores'],
  ['marques', 'marcas'],
  ['filiale', 'filial'],
  ['équipe', 'equipa'],
  ['centre de formation', 'centro de formação'],
  ['salles', 'salas'],
  ['ateliers', 'oficinas'],
  ['réservation', 'reserva'],
  ['assistance', 'assistência'],
  ['parcours', 'percursos'],
  ['évaluations', 'avaliações'],
  ['inscription', 'inscrição'],
  ['progression', 'progressão'],
  ['contenus', 'conteúdos'],
  ['compte', 'conta'],
  ['données personnelles', 'dados pessoais'],
  ['traitement', 'tratamento'],
  ['droits', 'direitos'],
  ['accès', 'acesso'],
  ['rectification', 'retificação'],
  ['effacement', 'apagamento'],
  ['limitation', 'limitação'],
  ['opposition', 'oposição'],
  ['portabilité', 'portabilidade'],
  ['consentement', 'consentimento'],
  ['langue', 'idioma'],
  ['navigateur', 'navegador'],
  ['sécurité', 'segurança'],
  ['messagerie', 'mensagens'],
  ['authentification', 'autenticação'],
  ['hébergement', 'alojamento'],
  ['prestataires', 'prestadores'],
  ['sous-traitants', 'subcontratantes'],
  ['transferts', 'transferências'],
  ['réclamation', 'reclamação'],
  ['autorité', 'autoridade'],
  ['réglementation', 'regulamentação'],
  ['obligation légale', 'obrigação legal'],
  ['intérêt légitime', 'interesse legítimo'],
  ['exécution du contrat', 'execução do contrato'],
  ['mesures précontractuelles', 'medidas pré-contratuais'],
  ['Durée du compte', 'Duração da conta'],
  ['ans', 'anos'],
  ['mois', 'meses'],
  ['journaux', 'registos'],
  ['Tant que non effacées par l’utilisateur', 'Enquanto não forem apagadas pelo utilizador'],
  ['FR/EN', 'FR/EN/PT'],
  ['FR/EN)', 'FR/EN/PT)'],
  [' et ', ' e '],
  [' ou ', ' ou '],
  [' des ', ' dos '],
  [' les ', ' os '],
  [' le ', ' o '],
  [' la ', ' a '],
  [' de ', ' de '],
  [' du ', ' do '],
  [' une ', ' uma '],
  [' un ', ' um '],
  [' à ', ' a '],
  [' au ', ' ao '],
  [' par ', ' por '],
  [' pour ', ' para '],
  [' avec ', ' com '],
  [' sans ', ' sem '],
  [' sur ', ' sobre '],
  [' dans ', ' em '],
  ['L’', 'A '],
  ['l’', 'a '],
  ['d’', 'd’'],
  ['n’', 'n’'],
  ['qu’', 'qu’'],
  ['s’', 's’'],
  ["'", "'"],
]

function trFr(s) {
  if (typeof s !== 'string') return s
  let out = s
  for (const [fr, pt] of [...FR_PT].sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(fr).join(pt)
  }
  return out
}

function deepTr(obj) {
  if (Array.isArray(obj)) return obj.map(deepTr)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepTr(v)]))
  }
  return trFr(obj)
}

function serializeString(s) {
  const escaped = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  if (escaped.includes("'") && !escaped.includes('"')) {
    return `"${escaped.replace(/"/g, '\\"')}"`
  }
  return `'${escaped.replace(/'/g, "\\'")}'`
}

function serializeValue(v, indent) {
  if (typeof v === 'string') return serializeString(v)
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'string') {
      return `[${v.map((item) => serializeString(item)).join(', ')}]`
    }
    if (v.length && typeof v[0] === 'object') {
      return `[\n${v.map((item) => `${indent}  ${serializeObject(item, indent + '  ')},`).join('\n')}\n${indent}]`
    }
    return JSON.stringify(v)
  }
  if (v && typeof v === 'object') return serializeObject(v, indent)
  return String(v)
}

function serializeObject(obj, indent = '    ') {
  const lines = Object.entries(obj).map(([k, v]) => {
    const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : serializeString(k)
    return `${indent}${key}: ${serializeValue(v, indent + '  ')},`
  })
  return `{\n${lines.join('\n')}\n  }`
}

async function patchFile(file, exportName) {
  const filePath = `src/i18n/${file}`
  const mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`)
  const copy = mod[exportName]
  const pt = deepTr(copy.fr)
  let text = fs.readFileSync(filePath, 'utf8')
  const re = new RegExp(`(\\n  pt: \\{)[\\s\\S]*?(\\n  \\},\\n\\})`)
  if (!re.test(text)) {
    console.warn(`skip ${file} — pt block not found`)
    return
  }
  text = text.replace(re, `\n  pt: ${serializeObject(pt)},\n}`)
  fs.writeFileSync(filePath, text)
  console.log(`updated ${file} (${exportName})`)
}

await patchFile('legal.js', 'LEGAL_COPY')
await patchFile('privacy.js', 'PRIVACY_COPY')
await patchFile('delivery.js', 'DELIVERY_COPY')
