import { getProxyAdmin } from '../test/utils/fixtures'

const address: string = process.env[2] || ''

async function main() {
  const proxyAdmin = await getProxyAdmin()

  const implAddress = await proxyAdmin.getProxyImplementation(address)

  console.log(`impl at : ${implAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
