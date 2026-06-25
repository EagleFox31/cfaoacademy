/**
 * Ajoute les blocs `pt` manquants — source EN, traduction heuristique EN→PT.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const I18N_DIR = path.resolve('src/i18n')

const PHRASES = [
  ['Welcome back', 'Bem-vindo de volta'],
  ['Good morning', 'Bom dia'],
  ['Good afternoon', 'Boa tarde'],
  ['Good evening', 'Boa noite'],
  ['Merry Christmas', 'Feliz Natal'],
  ['Happy New Year', 'Feliz Ano Novo'],
  ["Happy New Year's Eve", 'Feliz véspera de Ano Novo'],
  ['Close and return to the previous page', 'Fechar e voltar à página anterior'],
  ['Close and return to home', 'Fechar e voltar ao início'],
  ['Please enter your username and password to sign in', 'Introduza o seu identificador e palavra-passe para entrar'],
  ['Enter your username', 'Introduza o seu nome de utilizador'],
  ['Enter your password', 'Introduza a sua palavra-passe'],
  ['Access your space', 'Aceda ao seu espaço'],
  ['Forgot password?', 'Palavra-passe esquecida?'],
  ['Remember me', 'Lembrar-me'],
  ['Back to home', 'Voltar ao início'],
  ['Back to sign in', 'Voltar ao início de sessão'],
  ['Test profiles', 'Perfis teste'],
  ['Open portal', 'Abrir portail'],
  ['Sign in', 'Entrar'],
  ['Sign out', 'Terminar sessão'],
  ['Contact us', 'Contacte-nos'],
  ['Learn more', 'Saber mais'],
  ['See all', 'Ver tudo'],
  ['See less', 'Ver menos'],
  ['See more', 'Ver mais'],
  ['Coming soon', 'Em breve'],
  ['In progress', 'Em curso'],
  ['To do', 'Por fazer'],
  ['Done', 'Concluído'],
  ['Upcoming', 'Próximo'],
  ['Certified', 'Certificado'],
  ['Learner', 'Aprendiz'],
  ['Trainer', 'Formador'],
  ['Team Manager', 'Chefe de equipa'],
  ['Workshop Manager', 'Chefe de oficina'],
  ['Branch HR', 'RH Filial'],
  ['Group Admin', 'Admin Grupo'],
  ['Super Admin', 'Super Admin'],
  ['Build team', 'Equipa build'],
  ['Key Instructor', 'Formador principal'],
  ['Deputy Instructor', 'Formador suplente'],
  ['Preventive maintenance', 'Manutenção preventiva'],
  ['preventive maintenance', 'manutenção preventiva'],
  ['Maintenance', 'Manutenção'],
  ['repair', 'reparação'],
  ['Repair', 'Reparação'],
  ['diagnostics', 'diagnóstico'],
  ['Diagnostics', 'Diagnóstico'],
  ['overhaul', 'revisão geral'],
  ['Overhaul', 'Revisão geral'],
  ['certification', 'certificação'],
  ['Certification', 'Certificação'],
  ['training', 'formação'],
  ['Training', 'Formação'],
  ['session', 'sessão'],
  ['Session', 'Sessão'],
  ['sessions', 'sessões'],
  ['Sessions', 'Sessões'],
  ['In person', 'Presencial'],
  ['Remote', 'À distância'],
  ['E-learning', 'E-learning'],
  ['Aftersales', 'Pós-venda'],
  ['aftersales', 'pós-venda'],
  ['Body shop', 'Carroçaria'],
  ['body shop', 'carroçaria'],
  ['Overview', 'Visão geral'],
  ['Dashboard', 'Painel'],
  ['Progress', 'Progresso'],
  ['progress', 'progresso'],
  ['Enrolled', 'Inscrito'],
  ['Planned', 'Previsto'],
  ['Open', 'Abrir'],
  ['Save', 'Guardar'],
  ['Cancel', 'Cancelar'],
  ['Search', 'Pesquisar'],
  ['Filter', 'Filtrar'],
  ['All', 'Todos'],
  ['Description', 'Descrição'],
  ['Duration', 'Duração'],
  ['Location', 'Local'],
  ['Date', 'Data'],
  ['Brand', 'Marca'],
  ['Level', 'Nível'],
  ['Score', 'Pontuação'],
  ['Questions', 'Perguntas'],
  ['Attempts', 'Tentativas'],
  ['Read article', 'Ler artigo'],
  ['News', 'Notícias'],
  ['Featured', 'Destaque'],
  ['Events', 'Eventos'],
  ['Testimonials', 'Testemunhos'],
  ['Privacy', 'Privacidade'],
  ['Legal', 'Informação legal'],
  ['Cameroon', 'Camarões'],
  ['countries', 'países'],
  ['brands', 'marcas'],
  ['courses', 'formações'],
  ['Choose language', 'Escolher idioma'],
  ['Back to top', 'Voltar ao topo'],
  ['Our ', 'As nossas '],
  ['Our', 'Os nossos'],
  ['The Academy', 'A Academy'],
  ['Contact', 'Contacto'],
  ['Send', 'Enviar'],
  ['Sending', 'A enviar'],
  ['Full name', 'Nome completo'],
  ['Message', 'Mensagem'],
  ['Subject', 'Assunto'],
  ['Employee', 'Colaborador'],
  ['Branch', 'Filiale'],
  ['Status', 'Estado'],
  ['View', 'Ver'],
  ['Export', 'Exportar'],
  ['Discover', 'Descobrir'],
  ['Calendar', 'Calendário'],
  ['Skills', 'Competências'],
  ['Theory', 'Teoria'],
  ['Practical', 'Prática'],
  ['Junior', 'Júnior'],
  ['Senior', 'Sénior'],
  ['Expert', 'Especialista'],
  ['Collapse', 'Recolher'],
  ['Scheduled', 'Agendado'],
  ['Completed', 'Concluído'],
  ['Continue', 'Continuar'],
  ['Start', 'Iniciar'],
  ['Reminder', 'Lembrete'],
  ['Catalogue', 'Catálogo'],
  ['Demo', 'Demo'],
  ['Inactive', 'Inativo'],
  ['Alert', 'Alerta'],
  ['Alerts', 'Alertas'],
  ['Directory', 'Diretório'],
  ['Activity', 'Atividade'],
  ['Assistance', 'Assistência'],
  ['Resolved', 'Resolvido'],
  ['Updated on', 'Atualizado em'],
  ['Obtained on', 'Obtido em'],
  ['Passed on', 'Aprovado em'],
  ['Scheduled for', 'Agendado para'],
  ['Target', 'Objetivo'],
  ['Requirements', 'Requisitos'],
  ['Completed on', 'Concluído em'],
  ['Valid until', 'Válido até'],
  ['Certificate', 'Certificado'],
  ['Instructor', 'Formador'],
  ['Contents', 'Conteúdos'],
  ['Pass mark', 'Nota mínima'],
  ['Feedback', 'Feedback'],
  ['Period', 'Período'],
  ['Type', 'Tipo'],
  ['Results', 'Resultados'],
  ['Profile', 'Perfil'],
  ['Manage', 'Gerir'],
  ['Team', 'Equipa'],
  ['Group', 'Grupo'],
  ['Overview', 'Visão geral'],
  ['North Africa', 'África do Norte'],
  ['West Africa', 'África Ocidental'],
  ['Central Africa', 'África Central'],
  ['East Africa', 'África Oriental'],
  ['Southern Africa & Indian Ocean', 'África Austral e Oceano Índico'],
  ['in progress', 'em curso'],
  ['Regions', 'Regiões'],
  ['North', 'Norte'],
  ['West', 'Oeste'],
  ['Central', 'Central'],
  ['East', 'Este'],
  ['Southern', 'Sul'],
]

function translateString(str) {
  if (typeof str !== 'string') return str
  let out = str
  const sorted = [...PHRASES].sort((a, b) => b[0].length - a[0].length)
  for (const [en, pt] of sorted) {
    out = out.split(en).join(pt)
  }
  return out
}

function deepTranslate(obj) {
  if (Array.isArray(obj)) return obj.map(deepTranslate)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepTranslate(v)]))
  }
  return translateString(obj)
}

function serializeString(s) {
  if (s.includes("'") && !s.includes('"')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function serializeValue(v, indent) {
  if (typeof v === 'string') return serializeString(v)
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object' && !Array.isArray(v[0])) {
      return `[\n${v.map(item => `${indent}  ${serializeObject(item, indent + '  ')},`).join('\n')}\n${indent}]`
    }
    return JSON.stringify(v)
  }
  if (v && typeof v === 'object') return serializeObject(v, indent)
  return String(v)
}

function serializeObject(obj, indent = '  ') {
  const lines = Object.entries(obj).map(([k, v]) => {
    const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : serializeString(k)
    return `${indent}${key}: ${serializeValue(v, indent + '  ')},`
  })
  return `{\n${lines.join('\n')}\n${indent.slice(0, -2)}}`
}

function addPtToExport(text, exportName, copy) {
  if (copy.pt) return text
  if (!copy.en && !copy.fr) return text

  const source = Object.keys(copy.en ?? {}).length ? copy.en : copy.fr
  const pt = deepTranslate(source)
  const ptBlock = `  pt: ${serializeObject(pt, '    ')},\n`

  const re = new RegExp(`(export const ${exportName} = \\{[\\s\\S]*?\\n  en: \\{[\\s\\S]*?\\n  \\},\\n)(\\})`)
  if (!re.test(text)) {
    console.warn(`  pattern not found for ${exportName}`)
    return text
  }
  return text.replace(re, `$1${ptBlock}$2`)
}

async function main() {
  const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.js') && f !== 'index.js')
  let updated = 0

  for (const file of files) {
    if (file === 'nav.js' || file === 'common.js') continue
    const filePath = path.join(I18N_DIR, file)
    let text = fs.readFileSync(filePath, 'utf8')
    if (/\n\s+pt:\s*\{/.test(text)) {
      console.log(`skip ${file}`)
      continue
    }

    const mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`)
    const exports = Object.keys(mod).filter(k => k.endsWith('_COPY'))

    for (const exportName of exports) {
      const before = text
      text = addPtToExport(text, exportName, mod[exportName])
      if (text !== before) console.log(`  + pt → ${exportName} in ${file}`)
    }

    if (text !== fs.readFileSync(filePath, 'utf8')) {
      fs.writeFileSync(filePath, text, 'utf8')
      updated++
    }
  }

  console.log(`Done: ${updated} file(s)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
