/**
 * Régénère PORTAL_COPY.pt à partir de PORTAL_COPY.fr
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const FR_PT = [
  ['Bon retour', 'Bem-vindo de volta'],
  ['Bonjour', 'Bom dia'],
  ['Bon après-midi', 'Boa tarde'],
  ['Bonsoir', 'Boa noite'],
  ['Joyeux Noël', 'Feliz Natal'],
  ['Bonne année', 'Feliz Ano Novo'],
  ["Bonne fin d'année", 'Feliz véspera de Ano Novo'],
  ['Apprenant', 'Aprendiz'],
  ['Key Instructor', 'Key Instructor'],
  ['Formateur suppléant', 'Formador suplente'],
  ["Chef d'équipe", 'Chefe de equipa'],
  ["Chef d'atelier", 'Chefe de oficina'],
  ['Dir. Pièces & Services', 'Dir. Peças e Serviços'],
  ['Dir. des Opérations', 'Dir. Operações'],
  ['Directeur Filiale', 'Diretor de filiale'],
  ['RH Filiale', 'RH Filial'],
  ['Admin Filiale', 'Admin Filial'],
  ['Admin Groupe', 'Admin Grupo'],
  ['RH Groupe', 'RH Grupo'],
  ['Super Admin', 'Super Admin'],
  ['Équipe build', 'Equipa build'],
  ['Formateur', 'Formador'],
  ['Dir. Centre de formation', 'Dir. Centro de formação'],
  ['Assistante centre', 'Assistente de centro'],
  ['Modules complétés', 'Módulos concluídos'],
  ['Progression globale', 'Progressão global'],
  ['Certification', 'Certificação'],
  ['Certifications', 'Certificações'],
  ['Test pratique à venir', 'Teste prático a realizar'],
  ['Tests pratiques à venir', 'Testes práticos a realizar'],
  ['Modules (parcours perso)', 'Módulos (percurso pessoal)'],
  ['Ma progression', 'A minha progressão'],
  ['Apprenants à former', 'Aprendizes a formar'],
  ['Collaborateurs', 'Colaboradores'],
  ['Progression moyenne', 'Progressão média'],
  ['Certifié', 'Certificado'],
  ['Certifiés', 'Certificados'],
  ['Alerte', 'Alerta'],
  ['Alertes', 'Alertas'],
  ['Alerte inactivité', 'Alerta de inatividade'],
  ['Alertes inactivité', 'Alertas de inatividade'],
  ['En formation active', 'Em formação ativa'],
  ['Apprenants actifs', 'Aprendizes ativos'],
  ['Taux de certification', 'Taxa de certificação'],
  ['Sessions en cours', 'Sessões em curso'],
  ['Filiales actives', 'Filiais ativas'],
  ['Terminé', 'Concluído'],
  ['En cours', 'Em curso'],
  ['À faire', 'Por fazer'],
  ['Bientôt disponible', 'Em breve'],
  ['À venir', 'A venir'],
  ['⚠ Inactif', '⚠ Inativo'],
  ["Vue d'ensemble", 'Visão geral'],
  ['Groupe', 'Grupo'],
  ['Mon bilan', 'O meu balanço'],
  ["Tableau de bord équipe", 'Painel de equipa'],
  ['Tableau de bord filiale', 'Painel de filial'],
  ['Tableau de bord groupe', 'Painel de grupo'],
  ['Plan individuel', 'Plano individual'],
  ['Mon plan individuel de formation (PIF)', 'O meu plano individual de formação (PIF)'],
  ['PIF pluri annuel', 'PIF plurianual'],
  ['Mon planning 2026', 'O meu planning 2026'],
  ['Ouvrir', 'Abrir'],
  ['Application à venir', 'Aplicação em breve'],
  ['Assigné par', 'Atribuído por'],
  ['Objectif', 'Objetivo'],
  ['Année prévue', 'Ano previsto'],
  ['Modules effectués', 'Módulos realizados'],
  ['Calendrier', 'Calendário'],
  ['Inscrit', 'Inscrito'],
  ['Prévu', 'Previsto'],
  ['Description', 'Descrição'],
  ['Contenu', 'Conteúdo'],
  ['Score', 'Pontuação'],
  ['Seuil de réussite', 'Nota mínima'],
  ['Tentatives', 'Tentativas'],
  ['Questions', 'Perguntas'],
  ['Retour formateur', 'Feedback do formador'],
  ['Terminé le', 'Concluído em'],
  ["Valide jusqu'au", 'Válido até'],
  ['N° certificat', 'N.º certificado'],
  ['Niveau', 'Nível'],
  ['Formation', 'Formação'],
  ['Marque', 'Marca'],
  ['Durée', 'Duração'],
  ['Date', 'Data'],
  ['Lieu', 'Local'],
  ['Formateur', 'Formador'],
  ['Période', 'Período'],
  ['Prochaine session', 'Próxima sessão'],
  ['Formation continue', 'Formação contínua'],
  ['Compétences', 'Competências'],
  ['Reconnaissance constructeur', 'Reconhecimento construtor'],
  ['Rôle apprenant', 'Papel de aprendiz'],
  ['Rôle formateur', 'Papel de formador'],
  ['Encadrement terrain', 'Supervisão em terreno'],
  ['Progression individuelle', 'Progressão individual'],
  ['Vue équipe', 'Vista de equipa'],
  ['Dossiers formation', 'Processos de formação'],
  ['Périmètre groupe', 'Âmbito grupo'],
  ['Audit', 'Auditoria'],
  ['Mes résultats', 'Os meus resultados'],
  ['Mes tests & résultats', 'Os meus testes e resultados'],
  ['Filtrer', 'Filtrar'],
  ['Tous', 'Todos'],
  ['Mes certifications', 'As minhas certificações'],
  ['Mes apprenants', 'Os meus aprendizes'],
  ['Mon équipe', 'A minha equipa'],
  ['Mes équipes', 'As minhas equipas'],
  ['Répertoire', 'Diretório'],
  ['Progression filiale', 'Progressão da filial'],
  ['Activité récente', 'Atividade recente'],
  ['Collaborateur', 'Colaborador'],
  ['Progression', 'Progressão'],
  ['Statut', 'Estado'],
  ['Dernière activité', 'Última atividade'],
  ['Rôle', 'Papel'],
  ['Département', 'Departamento'],
  ['Dernière connexion', 'Último login'],
  ['Filiale', 'Filial'],
  ['Apprenants', 'Aprendizes'],
  ['Taux cert.', 'Taxa cert.'],
  ['Rechercher', 'Pesquisar'],
  ['Exporter CSV', 'Exportar CSV'],
  ['Attestation', 'Attestation'],
  ['Obtenu le', 'Obtido em'],
  ['Prévu le', 'Agendado para'],
  ['Réussi le', 'Aprovado em'],
  ['Se connecter', 'Entrar'],
  ['Déconnexion', 'Terminar sessão'],
  ['Retour au site', 'Voltar ao site'],
  ['Mon espace', 'O meu espaço'],
  ['Mon portail', 'O meu portail'],
  ['Découvrir', 'Descobrir'],
  ['Catalogue', 'Catálogo'],
  ['Demo', 'Demo'],
  ['Continuer', 'Continuar'],
  ['Commencer', 'Iniciar'],
  ['Voir', 'Ver'],
  ['Rappel', 'Lembrete'],
  ['Voir plus', 'Ver mais'],
  ['Voir moins', 'Ver menos'],
  ['Présentiel', 'Presencial'],
  ['Distanciel', 'À distância'],
  ['Coaching', 'Coaching'],
  ['Mentoring', 'Mentoring'],
  ['Fait', 'Feito'],
  ['À inscrire', 'Por inscrever'],
  ['À programmer', 'Por agendar'],
  ['Inscription', 'Inscrição'],
  ['Année', 'Ano'],
  ['Semaine', 'Semana'],
  ['Envoyer', 'Enviar'],
  ['Enregistrer', 'Guardar'],
  ['Annuler', 'Cancelar'],
  ['Fermer', 'Fechar'],
  ['Théorie', 'Teoria'],
  ['Pratique', 'Prática'],
  ['Junior', 'Júnior'],
  ['Senior', 'Sénior'],
  ['Expert', 'Especialista'],
  ['Maintenance', 'Manutenção'],
  ['Réparation', 'Reparação'],
  ['Diagnostic', 'Diagnóstico'],
  ['Diagnostics', 'Diagnósticos'],
  ['par ', 'por '],
  [' et ', ' e '],
  [' ou ', ' ou '],
  [' de ', ' de '],
  [' le ', ' o '],
  [' la ', ' a '],
  [' les ', ' os '],
  [' des ', ' dos '],
  [' du ', ' do '],
  [' une ', ' uma '],
  [' un ', ' um '],
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
  if (s.includes("'") && !s.includes('"')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function serializeValue(v, indent) {
  if (typeof v === 'string') return serializeString(v)
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

const mod = await import(`${pathToFileURL('src/i18n/portal.js').href}?t=${Date.now()}`)
const pt = deepTr(mod.PORTAL_COPY.fr)

let text = fs.readFileSync('src/i18n/portal.js', 'utf8')
text = text.replace(/\n  pt: \{[\s\S]*?\n  \},\n\}/, `\n  pt: ${serializeObject(pt)},\n}`)
fs.writeFileSync('src/i18n/portal.js', text)
console.log('portal.js pt regenerated from fr')
