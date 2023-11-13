import { ethers } from 'hardhat'
import { FaucetStaging } from '../typechain-types/contracts/token/FaucetStaging'

async function main() {
  const ecoAddress = '0xD2f598c826429EEe7c071C02735549aCd88F2c09'
  const faucetFactory = await ethers.getContractFactory('FaucetStaging')

  const faucet: FaucetStaging = await faucetFactory.deploy(
    ecoAddress,
    5,
    10,
    '0xDD1834f5116c4E2DCE952220dE5641cc775FdaaD',
    ['0xDD1834f5116c4E2DCE952220dE5641cc775FdaaD', '0xb64268D571152C05bAb78AD4C9E2790CdDE2Eb00']
  )
  // enable multiDrip for staging contract only, NOT-PRODUCTION
  await faucet.updateMultiDrip(true)
  console.log('FaucetStaging deployed to:', faucet.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
