import * as ethers from 'ethers'
import * as fs from 'fs'
require('dotenv').config({ path: '.env' })

let RPCURL = process.env.RPCURL || ''
let pk = process.env.PRIVKEY || ''
let pk2 = process.env.OTHRKEY || ''
let POLICY = process.env.ROOT_POLICY || ''
// let ecoxAddress = process.env.TOKEN || ''
// let ecoxStakingAddress = '0xb26f87e63fc9a3ffe8a4a27c66f85191cd8a9680'
let sup = '0x35244C622E5034Dc1BCf2FF3931cfA57192572FF'

function getABI(path: string) {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
}
let stub = `artifacts/contracts/`

//ABIs

// let forwardProxyABI = getABI(`${stub}proxy/ForwardProxy.sol/ForwardProxy.json`)
// let ecoxABI = getABI(`${stub}currency/ECOx.sol/ECOx.json`)
// let ecoxStakingABI = getABI(`${stub}governance/community/ECOxStaking.sol/ECOxStaking.json`)
// let implementationUpdatingABI = getABI(`${stub}test/ImplementationUpdatingTarget.sol/ImplementationUpdatingTarget.json`)
// let ecoInitializableABI = getABI(`${stub}deploy/EcoInitializable.sol/EcoInitializable.json`)
// let ecoABI = getABI(`${stub}currency/ECO.sol/ECO.json`)

let L1ECOBridgeABI = getABI('artifacts/contracts/bridge/L1ECOBridge.sol/L1ECOBridge.json')
let L2ECOBridgeABI = getABI('artifacts/contracts/bridge/L2ECOBridge.sol/L2ECOBridge.json')
let L2ECOABI = getABI('artifacts/contracts/token/L2ECO.sol/L2ECO.json')


let provider: ethers.providers.BaseProvider = new ethers.providers.JsonRpcProvider(RPCURL)
let wallet: ethers.Wallet = new ethers.Wallet(pk, provider)

let ID_ECO = ethers.utils.solidityKeccak256(['string'], ['ECO'])

// let UNI_V2 = '0x09bc52b9eb7387ede639fc10ce5fa01cbcbf2b17'

// let NOTIFIER_DATA = '0xfff6cae9'

const staked = ethers.utils.parseEther('50')
let seed = '0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd'
let tx

// async function callFuse() {
//     let proxy = new ethers.Contract('0xfC6632E95588902C967BBdc47e1a7d28350f88b9', ecoInitializableABI.abi, wallet)

//     // fusing to an existing ecoxStaking
//     tx = await proxy.fuseImplementation('0x8c8119C3fD6e40b4C047C946480Abe306be04A7F')
//     tx = await tx.wait()
//     console.log(tx.status)

//     proxy = new ethers.Contract('0xfC6632E95588902C967BBdc47e1a7d28350f88b9', ecoxStakingABI.abi, wallet)
//     console.log(await proxy.implementation())
// }

// async function deployInitializeable() {
//     let initializeableFactory = new ethers.ContractFactory(ecoInitializableABI.abi, ecoInitializableABI.bytecode, wallet)
//     let initializeable = await initializeableFactory.deploy(wallet.address)
//     await initializeable.deployTransaction.wait()
//     console.log(initializeable.address)
// }

async function deployL1Bridge() {
    let bridgeFactory = new ethers.ContractFactory(L1ECOBridgeABI.abi, L1ECOBridgeABI.bytecode, wallet)
    let currGasPrice = ethers.BigNumber.from(await wallet.getGasPrice())
    let theNonce = await wallet.getTransactionCount()
    console.log(currGasPrice.toString())
    console.log(theNonce)
    currGasPrice = currGasPrice.mul(12).div(10)

    let bridge = await bridgeFactory.deploy({
        gasPrice: currGasPrice,
        nonce: theNonce + 1
    })
    await bridge.deployTransaction.wait()
    console.log(bridge.address)
}

async function deployL2ECO() {
    console.log(await wallet.getChainId())
    console.log(await wallet.getBalance())
    let L2ECOFactory = new ethers.ContractFactory(L2ECOABI.abi, L2ECOABI.bytecode, wallet)
    let L2ECO = await L2ECOFactory.deploy()
    await L2ECO.deployTransaction.wait()
    console.log(L2ECO.address)
}

async function deployL2Bridge() {
    let bridgeFactory = new ethers.ContractFactory(L2ECOBridgeABI.abi, L2ECOBridgeABI.bytecode, wallet)
    let currGasPrice = ethers.BigNumber.from(await wallet.getGasPrice())
    let theNonce = await wallet.getTransactionCount()
    console.log(currGasPrice.toString())
    console.log(theNonce)
    // currGasPrice = currGasPrice.mul(12).div(10)

    let bridge = await bridgeFactory.deploy('0x4200000000000000000000000000000000000007', '0x383eB66F810F56442351B642fC8b223C9C2e9B07', '0xE44Eed627F3fb2B39B462f4EC90eB78513039f87')
    await bridge.deployTransaction.wait()
    console.log(bridge.address)
}

async function sendGOR(_amt: string) {
    const otherWallet = new ethers.Wallet(pk2, provider)
    const amt = ethers.utils.parseEther(_amt)
    tx = await otherWallet.sendTransaction({
        to: wallet.address,
        value: amt
    })
    tx = await tx.wait()
    console.log(tx.status)
}

async function initializeL2ECO() {
    const l2eco = new ethers.Contract('0xE44Eed627F3fb2B39B462f4EC90eB78513039f87', L2ECOABI.abi, wallet)
    tx = await l2eco.initialize('0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3', '0x2b96D98da64E733B6014A41A2c580142ffe3fb2e', wallet.address)
    tx = await tx.wait()
    console.log(tx.status)
    // console.log((await l2eco.linearInflationMultiplier()).toString())
}

async function initializeL1Bridge() {
    const l1bridge = new ethers.Contract('0x383eB66F810F56442351B642fC8b223C9C2e9B07', L1ECOBridgeABI.abi, wallet)
    tx = await l1bridge.initialize('0x5086d1eEF304eb5284A0f6720f79403b4e9bE294', '0x2b96D98da64E733B6014A41A2c580142ffe3fb2e', '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3', wallet.address)
    tx = await tx.wait()
    console.log(tx.status)
    console.log((await l1bridge.inflationMultiplier()).toString())
}

// async function deployImplthing() {
//     // 
//     let implThingFactory = new ethers.ContractFactory(implementationUpdatingABI.abi, implementationUpdatingABI.bytecode, wallet)
//     let implThing = await implThingFactory.deploy()
//     await implThing.deployTransaction.wait()
//     console.log(`implThing.address: ${implThing.address}`)
// }

// async function newProxy() {
//     let proxyFactory = new ethers.ContractFactory(forwardProxyABI.abi, forwardProxyABI.bytecode, wallet)
//     let proxy = await proxyFactory.deploy('0xA2346A2AF137Fba4cEe65C01e3C8225537a8eb35')
//     await proxy.deployTransaction.wait()
//     console.log(`staking proxy: ${proxy.address}`)
// }

async function rebaseCrossChain() {
    const l1bridge = new ethers.Contract('0x383eB66F810F56442351B642fC8b223C9C2e9B07', L1ECOBridgeABI.abi, wallet)
    tx = await l1bridge.rebase('10')
    tx = await tx.wait()
    console.log(`${tx.status} rebased!`)
}

// async function approveAndDeposit() {
//     const l1bridge = new ethers.Contract('0x383eB66F810F56442351B642fC8b223C9C2e9B07', L1ECOBridgeABI.abi, wallet)
//     // tx = await l1bridge.rebase()


//     const data = ethers.utils.arrayify('0x1234')
//     console.log(ethers.utils.isBytes(data))

//     const l1Eco = new ethers.Contract('0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3', ecoABI.abi, wallet)
//     tx = await l1Eco.approve(l1bridge.address, ethers.utils.parseEther('1'))
//     tx = await tx.wait()
//     console.log(`${tx.status}`)

//     tx = await l1bridge.depositERC20(l1Eco.address, '0xE44Eed627F3fb2B39B462f4EC90eB78513039f87', ethers.utils.parseEther('1'), '0', data)
//     tx = await tx.wait()
//     console.log(`${tx.status}!!!`)
// }

async function bridgeItBackNowYall() {
    const data = ethers.utils.arrayify('0x1234')
    const l2bridge = new ethers.Contract('0x2b96D98da64E733B6014A41A2c580142ffe3fb2e', L2ECOBridgeABI.abi, wallet)
    tx = await l2bridge.withdraw('0xE44Eed627F3fb2B39B462f4EC90eB78513039f87', ethers.utils.parseEther('1'), '200000', data)
    tx = await tx.wait()
    console.log(`${tx.status}`)
}

async function checkInterface() {
    const l2Eco = new ethers.Contract('0xAcEe5195091C619Ce5CccdE747E7eaF691cb080B', L2ECOABI.abi, wallet)
    tx = await l2Eco.supportsInterface('0x1d1d8b63')
    console.log(tx)
}

// deployInitializeable()
// deployL1Bridge()
// deployL2Bridge()
// sendGOR('.97')
// deployL2ECO()
initializeL2ECO()
// initializeL1Bridge()
// approveAndDeposit()
// rebaseCrossChain()
// bridgeItBackNowYall()
// checkInterface()