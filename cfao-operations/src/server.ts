import { app } from './app.js'
import { config } from './config/index.js'
import { migrer } from './db/migrations.js'
import { getPool } from './db/pool.js'

// Le schema d'ops-db est a jour avant la premiere requete.
const appliquees = await migrer(getPool())
if (appliquees.length) {
  // eslint-disable-next-line no-console
  console.log('migrations appliquées :', appliquees.join(', '))
}

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`cfao-operations en écoute sur :${config.port}`)
})
