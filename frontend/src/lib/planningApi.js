/**
 * API du module cfao-planning (clé de répartition). Même jeton et même
 * gestion 401/403 que le client du portail (lib/api.js).
 */
import { createClient } from './api'
import { downloadBlob } from '../components/sheet/sheetExport'

const BASE = import.meta.env.VITE_PLANNING_API_URL || '/api/v1/planning'
const http = createClient(BASE)

const qs = params => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  return s.toString() ? `?${s}` : ''
}

const multipart = (file, params = {}) => {
  const form = new FormData()
  form.append('file', file)
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') form.append(k, v) })
  return form
}

/** Portée d'une vue : une clé (id) ou « tous pôles » d'une année (pole ALL). */
const scopePath = s => (s.pole === 'ALL' ? `/years/${s.year}` : `/cost-keys/${s.id}`)

async function download(path, filename) {
  downloadBlob(await http.get(path, { blob: true }), filename)
}

export const planningApi = {
  access: () => http.get('/access'),
  keys: () => http.get('/cost-keys/'),
  bootstrap: body => http.post('/cost-keys/', { body }),
  updateKey: (id, body) => http.patch(`/cost-keys/${id}`, { body }),
  freeze: id => http.post(`/cost-keys/${id}/freeze`),
  report: (id, mode) => http.get(`/cost-keys/${id}/report${qs({ mode })}`),
  global: (id, mode) => http.get(`/cost-keys/${id}/global${qs({ mode })}`),
  country: (id, code, mode) => http.get(`/cost-keys/${id}/countries/${code}${qs({ mode })}`),
  compare: id => http.get(`/cost-keys/${id}/compare`),
  match: id => http.get(`/cost-keys/${id}/match`),
  unchosen: id => http.get(`/cost-keys/${id}/unchosen-modules`),
  yearGlobal: (year, mode) => http.get(`/years/${year}/global${qs({ mode })}`),
  yearCountry: (year, code, mode) => http.get(`/years/${year}/countries/${code}${qs({ mode })}`),

  downloadGlobal: (key, mode, lang) => download(
    `${scopePath(key)}/global.xlsx${qs({ mode, lang })}`, `cle-${key.year}-${key.pole}-global.xlsx`),
  downloadAll: (key, mode, lang) => download(
    `${scopePath(key)}/export.xlsx${qs({ mode, lang })}`, `cle-${key.year}-${key.pole}.xlsx`),
  downloadCountry: (key, code, mode, lang) => download(
    `${scopePath(key)}/countries/${code}.xlsx${qs({ mode, lang })}`, `cle-${key.year}-${code}.xlsx`),

  imports: kind => http.get(`/imports/${qs({ kind })}`),
  importDetail: id => http.get(`/imports/${id}`),
  downloadTemplate: kind => download(`/imports/${kind}/template`, `modele-${kind}.xlsx`),
  preview: (kind, file, params) => http.post(`/imports/${kind}/preview`, { form: multipart(file, params) }),
  apply: (kind, file, params) => http.post(`/imports/${kind}/apply`, { form: multipart(file, params) }),
}
