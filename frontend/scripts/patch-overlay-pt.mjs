import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const PHRASES = [
  ['Preventive maintenance', 'Manutenção preventiva'],
  ['preventive maintenance', 'manutenção preventiva'],
  ['repair', 'reparação'],
  ['Repair', 'Reparação'],
  ['overhaul', 'revisão geral'],
  ['diagnostics', 'diagnóstico'],
  ['Diagnostics', 'Diagnóstico'],
  ['certification', 'certificação'],
  ['Aftersales', 'Pós-venda'],
  ['aftersales', 'pós-venda'],
  ['Processing and submitting warranty claims', 'Processamento e submissão de pedidos de garantia'],
  ['Safe intervention', 'Intervenção segura'],
  ['Workshop safety', 'Segurança em oficina'],
  ['Failure analysis', 'Análise de avarias'],
  ['Mechanical noise', 'Ruído mecânico'],
  ['customer management', 'gestão de clientes'],
  ['service advisor', 'conselheiro de serviço'],
  ['Stripping', 'Desmontagem'],
  ['Straightening', 'Retificação'],
  ['Paintless dent removal', 'Remoção de amolgadelas sem pintura'],
  ['Refurbishing', 'Renovação'],
  ['Preparing', 'Preparação'],
  ['Replacement and extraction', 'Substituição e extração'],
  ['Drafting a technical anomaly report', 'Redação de relatório de anomalia técnica'],
  ['Defining the operational standard', 'Definição do standard operacional'],
  ['Assessing', 'Avaliação'],
  ['Deploying', 'Implementação'],
  ['Sustaining', 'Manutenção'],
  ['Standardising', 'Normalização'],
  ['Developing technical sales arguments', 'Desenvolvimento de argumentos técnicos de venda'],
  ['Using the', 'Utilização da'],
  ['parts catalogue platform', 'plataforma de catálogo de peças'],
  ['Periodic and non-periodic', 'Periódica e não periódica'],
  ['Processing and submitting', 'Processamento e submissão'],
  ['Proposing technical vehicle improvements', 'Proposta de melhorias técnicas do veículo'],
  ['First customer vehicle maintenance call', 'Primeira chamada de manutenção do veículo do cliente'],
  ['Preparing customer vehicle reception', 'Preparação da receção do veículo do cliente'],
  ['Receiving the vehicle with the customer', 'Receção do veículo com o cliente'],
  ['Tracking customer vehicle work', 'Acompanhamento do trabalho no veículo do cliente'],
  ['Returning the customer vehicle', 'Entrega do veículo ao cliente'],
  ['Customer satisfaction survey after service', 'Inquérito de satisfação do cliente após serviço'],
  ['Maintenance', 'Manutenção'],
  ['Training', 'Formação'],
  ['Training Schedule', 'Calendário de formação'],
  ['Engine R&R', 'Desmontagem e montagem de motor'],
  ['Diesel engine management', 'Gestão de motor diesel'],
  ['electric vehicle', 'veículo elétrico'],
  ['electric vehicles', 'veículos elétricos'],
  ['gearbox', 'caixa de velocidades'],
  ['gearboxes', 'caixas de velocidades'],
  ['braking', 'travagem'],
  ['suspension', 'suspensão'],
  ['steering', 'direção'],
  ['electrical', 'elétrico'],
  ['Electrical', 'Elétrico'],
  ['air conditioning', 'ar condicionado'],
  ['alternator', 'alternador'],
  ['starter', 'motor de arranque'],
  ['vehicle systems', 'sistemas do veículo'],
  ['Vehicle', 'Veículo'],
  ['vehicle', 'veículo'],
  ['systems', 'sistemas'],
  ['chassis', 'chassis'],
  ['Petrol and diesel engine', 'Motor a gasolina e diesel'],
  ['Petrol engine', 'Motor a gasolina'],
  ['hybrid engine', 'motor híbrido'],
  ['Hydraulic repair', 'Reparação hidráulica'],
  ['forklifts', 'empilhadores'],
  ['reach trucks', 'empilhadores retrácteis'],
  ['telehandlers', 'carregadoras telescópicas'],
  ['excavators', 'escavadoras'],
  ['loaders', 'carregadoras'],
  ['bulldozers', 'buldózeres'],
  ['compactor', 'compactador'],
  ['backhoe loader', 'retroescavadora'],
  ['motor grader', 'niveladora'],
  ['bus systems', 'sistemas de autocarro'],
  ['truck systems', 'sistemas de camião'],
  ['braking system', 'sistema de travagem'],
  ['Electrical system', 'Sistema elétrico'],
  ['with ABS', 'com ABS'],
  ['Pre-delivery inspection', 'Inspeção pré-entrega'],
  ['Parts training', 'Formação de peças'],
  ['Parts department', 'Departamento de peças'],
  ['body panels', 'painéis de carroçaria'],
  ['body elements', 'elementos de carroçaria'],
  ['body parts', 'peças de carroçaria'],
  ['before painting', 'antes da pintura'],
  ['before paint application', 'antes da aplicação de tinta'],
  ['bonded vehicle glazing', 'vidros colados do veículo'],
  ['plastic body parts', 'peças plásticas de carroçaria'],
  ['aluminium', 'alumínio'],
  ['steel', 'aço'],
  ['multiplexed', 'multiplexado'],
  ['cross-system', 'multi-sistema'],
  ['case studies', 'estudos de caso'],
  ['noise', 'ruído'],
  ['failure', 'avaria'],
  ['failures', 'avarias'],
  ['manufacturer', 'fabricante'],
  ['warranty claims', 'pedidos de garantia'],
  ['maintenance parts', 'peças de manutenção'],
  ['transfer box', 'caixa de transferência'],
  ['differential', 'diferencial'],
  ['Manual and automatic A/C', 'Ar condicionado manual e automático'],
  ['in subsidiaries', 'nas filiais'],
  ['by aftersales', 'pelo pós-venda'],
  ['by service advisor', 'pelo conselheiro de serviço'],
]

function tr(s) {
  let out = s
  for (const [a, b] of [...PHRASES].sort((x, y) => y[0].length - x[0].length)) {
    out = out.split(a).join(b)
  }
  return out
}

function serializeString(s) {
  if (s.includes("'") && !s.includes('"')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

async function patch(file, exportName) {
  const filePath = `src/i18n/${file}`
  const mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`)
  const copy = mod[exportName]
  if (copy.pt) {
    console.log(`skip ${file}`)
    return
  }
  const pt = Object.fromEntries(Object.entries(copy.en).map(([k, v]) => [k, tr(v)]))
  const lines = Object.entries(pt).map(([k, v]) => `    ${serializeString(k)}: ${serializeString(v)},`)
  const block = `  pt: {\n${lines.join('\n')}\n  },\n`
  let text = fs.readFileSync(filePath, 'utf8')
  text = text.replace(/\n}\s*$/, `\n${block}}`)
  fs.writeFileSync(filePath, text)
  console.log(`patched ${file}`)
}

await patch('elearningTitles.js', 'ELEARNING_TITLES_COPY')
await patch('sessionTitles.js', 'SESSION_TITLES_COPY')
