import hre from 'hardhat'
import { getProxyAdmin } from '../test/utils/fixtures'
import { L2_NETWORK, l2BridgeProxyAddress } from './constants'

// this script is for transferring ownership of the proxy admin to the proxy

async function main() {
  hre.changeNetwork(L2_NETWORK)

  const proxyAdmin = await getProxyAdmin()

  const currentOwner = await proxyAdmin.owner()
  const [me] = await hre.ethers.getSigners()
  if ((await me.getAddress()) !== currentOwner) {
    throw new Error('you need to own the proxy admin to run this script')
  }

  await proxyAdmin.transferOwnership(l2BridgeProxyAddress)
  console.log(`admin owner changed to ${l2BridgeProxyAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
