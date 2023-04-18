// import * as ethers from 'ethers'
// import optimismSDK from "@eth-optimism/sdk"
const ethers = require("ethers")
const optimismSDK = require("@eth-optimism/sdk")
// import * as fs from 'fs'
require('dotenv').config({ path: '.env' })

// function getABI(path: string): ethers.utils.Interface {
//     return new ethers.utils.Interface(JSON.parse(fs.readFileSync(path, 'utf8')))
//     // return JSON.parse(fs.readFileSync(path, 'utf8'))
// }

//ABIs

// const forwardProxyABI = getABI(`${stub}proxy/ForwardProxy.sol/ForwardProxy.json`)
// const ecoxABI = getABI(`${stub}currency/ECOx.sol/ECOx.json`)
// const ecoxStakingABI = getABI(`${stub}governance/community/ECOxStaking.sol/ECOxStaking.json`)
// const implementationUpdatingABI = getABI(`${stub}test/ImplementationUpdatingTarget.sol/ImplementationUpdatingTarget.json`)
// const ecoInitializableABI = getABI(`${stub}deploy/EcoInitializable.sol/EcoInitializable.json`)
// const ecoABI = getABI(`${stub}currency/ECO.sol/ECO.json`)

// const L1ECOBridgeABI:ethers.utils.Interface = getABI('artifacts/contracts/bridge/L1ECOBridge.sol/L1ECOBridge.json')
// const L2ECOBridgeABI:ethers.utils.Interface = getABI('artifacts/contracts/bridge/L2ECOBridge.sol/L2ECOBridge.json')
// const L2ECOABI:ethers.utils.Interface = getABI('artifacts/contracts/token/L2ECO.sol/L2ECO.json')

const infuraAPIkey = process.env.API_KEY || ''
const pk = process.env.PRIVKEY || ''
const pk2 = process.env.OTHRKEY || ''
const POLICY = process.env.ROOT_POLICY || ''
// const ecoxAddress = process.env.TOKEN || ''
// const ecoxStakingAddress = '0xb26f87e63fc9a3ffe8a4a27c66f85191cd8a9680'
// const sup = '0x35244C622E5034Dc1BCf2FF3931cfA57192572FF'

const rpc_url1 = `https://goerli.infura.io/v3/${infuraAPIkey}`
const rpc_url2 = `https://optimism-goerli.infura.io/v3/${infuraAPIkey}`

const l1provider = new ethers.providers.JsonRpcProvider(rpc_url1)
const l2provider = new ethers.providers.JsonRpcProvider(rpc_url2)

let crossChainMessenger

async function setupOP() {
    const l1ChainId = (await l1provider.getNetwork()).chainId
    const l2ChainId = (await l2provider.getNetwork()).chainId
    const l1Wallet = new ethers.Wallet(pk, l1provider)
    const l2Wallet = new ethers.Wallet(pk, l2provider)
    crossChainMessenger = new optimismSDK.CrossChainMessenger({
        l1ChainId: l1ChainId,
        l2ChainId: l2ChainId,
        l1SignerOrProvider: l1Wallet,
        l2SignerOrProvider: l2Wallet,
        bedrock: true
})
}

// const ID_ECO = ethers.utils.solidityKeccak256(['string'], ['ECO'])

// const UNI_V2 = '0x09bc52b9eb7387ede639fc10ce5fa01cbcbf2b17'

// const NOTIFIER_DATA = '0xfff6cae9'

// const staked = ethers.utils.parseEther('50')
// const seed = '0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd'

// async function callFuse() {
//     const proxy = new ethers.Contract('0xfC6632E95588902C967BBdc47e1a7d28350f88b9', ecoInitializableABI.abi, wallet)

//     // fusing to an existing ecoxStaking
//     tx = await proxy.fuseImplementation('0x8c8119C3fD6e40b4C047C946480Abe306be04A7F')
//     tx = await tx.wait()
//     console.log(tx.status)

//     proxy = new ethers.Contract('0xfC6632E95588902C967BBdc47e1a7d28350f88b9', ecoxStakingABI.abi, wallet)
//     console.log(await proxy.implementation())
// }

// async function deployInitializeable() {
//     const initializeableFactory = new ethers.ContractFactory(ecoInitializableABI.abi, ecoInitializableABI.bytecode, wallet)
//     const initializeable = await initializeableFactory.deploy(wallet.address)
//     await initializeable.deployTransaction.wait()
//     console.log(initializeable.address)
// }

// async function deployL1Bridge() {
//     const bridgeFactory = ethers.ContractFactory.fromSolidity(L1ECOBridgeABI, l1Wallet)
//     const currGasPrice = ethers.BigNumber.from(await wallet.getGasPrice())
//     const theNonce = await wallet.getTransactionCount()
//     console.log(currGasPrice.toString())
//     console.log(theNonce)
//     currGasPrice = currGasPrice.mul(12).div(10)

//     const bridge = await bridgeFactory.deploy({
//         gasPrice: currGasPrice,
//         nonce: theNonce + 1
//     })
//     await bridge.deployTransaction.wait()
//     console.log(bridge.address)
// }

// async function deployL2ECO() {
//     console.log(await wallet.getChainId())
//     console.log(await wallet.getBalance())
//     const L2ECOFactory = new ethers.ContractFactory(L2ECOABI.abi, L2ECOABI.bytecode, wallet)
//     const L2ECO = await L2ECOFactory.deploy()
//     await L2ECO.deployTransaction.wait()
//     console.log(L2ECO.address)
// }

// async function deployL2Bridge() {
//     const bridgeFactory = new ethers.ContractFactory(L2ECOBridgeABI.abi, L2ECOBridgeABI.bytecode, wallet)
//     const currGasPrice = ethers.BigNumber.from(await wallet.getGasPrice())
//     const theNonce = await wallet.getTransactionCount()
//     console.log(currGasPrice.toString())
//     console.log(theNonce)
//     // currGasPrice = currGasPrice.mul(12).div(10)

//     const bridge = await bridgeFactory.deploy('0x4200000000000000000000000000000000000007', '0x383eB66F810F56442351B642fC8b223C9C2e9B07', '0xE44Eed627F3fb2B39B462f4EC90eB78513039f87')
//     await bridge.deployTransaction.wait()
//     console.log(bridge.address)
// }

// async function sendGOR(_amt: string) {
//     const otherWallet = new ethers.Wallet(pk2, provider)
//     const amt = ethers.utils.parseEther(_amt)
//     tx = await otherWallet.sendTransaction({
//         to: wallet.address,
//         value: amt
//     })
//     tx = await tx.wait()
//     console.log(tx.status)
// }

// async function initializeL2ECO() {
//     const l2eco = new ethers.Contract('0xE44Eed627F3fb2B39B462f4EC90eB78513039f87', L2ECOABI.abi, wallet)
//     tx = await l2eco.initialize('0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3', '0x2b96D98da64E733B6014A41A2c580142ffe3fb2e', wallet.address)
//     tx = await tx.wait()
//     console.log(tx.status)
//     // console.log((await l2eco.linearInflationMultiplier()).toString())
// }

// async function initializeL1Bridge() {
//     const l1bridge = new ethers.Contract('0x383eB66F810F56442351B642fC8b223C9C2e9B07', L1ECOBridgeABI.abi, wallet)
//     tx = await l1bridge.initialize('0x5086d1eEF304eb5284A0f6720f79403b4e9bE294', '0x2b96D98da64E733B6014A41A2c580142ffe3fb2e', '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3', wallet.address)
//     tx = await tx.wait()
//     console.log(tx.status)
//     console.log((await l1bridge.inflationMultiplier()).toString())
// }

// async function deployImplthing() {
//     // 
//     const implThingFactory = new ethers.ContractFactory(implementationUpdatingABI.abi, implementationUpdatingABI.bytecode, wallet)
//     const implThing = await implThingFactory.deploy()
//     await implThing.deployTransaction.wait()
//     console.log(`implThing.address: ${implThing.address}`)
// }

// async function newProxy() {
//     const proxyFactory = new ethers.ContractFactory(forwardProxyABI.abi, forwardProxyABI.bytecode, wallet)
//     const proxy = await proxyFactory.deploy('0xA2346A2AF137Fba4cEe65C01e3C8225537a8eb35')
//     await proxy.deployTransaction.wait()
//     console.log(`staking proxy: ${proxy.address}`)
// }

// async function rebaseCrossChain() {
//     const l1bridge = new ethers.Contract('0x383eB66F810F56442351B642fC8b223C9C2e9B07', L1ECOBridgeABI.abi, wallet)
//     tx = await l1bridge.rebase('10')
//     tx = await tx.wait()
//     console.log(`${tx.status} rebased!`)
// }

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

// async function bridgeItBackNowYall() {
//     const data = ethers.utils.arrayify('0x1234')
//     const l2bridge = new ethers.Contract('0x2b96D98da64E733B6014A41A2c580142ffe3fb2e', L2ECOBridgeABI.abi, wallet)
//     tx = await l2bridge.withdraw('0xE44Eed627F3fb2B39B462f4EC90eB78513039f87', ethers.utils.parseEther('1'), '200000', data)
//     tx = await tx.wait()
//     console.log(`${tx.status}`)
// }

// async function checkInterface() {
//     const l2Eco = new ethers.Contract('0xAcEe5195091C619Ce5CccdE747E7eaF691cb080B', L2ECOABI.abi, wallet)
//     tx = await l2Eco.supportsInterface('0x1d1d8b63')
//     console.log(tx)
// }

async function proveHash() {
    const withdrawalTx1 = { hash: '0xd96085aaa22a07baab1642ca8246882d429298660e71496aea687be7be802be4' }
    // await crossChainMessenger.waitForMessageStatus(withdrawalTx1.hash, optimismSDK.MessageStatus.READY_TO_PROVE)
    // const withdrawalTx2 = await crossChainMessenger.proveMessage(withdrawalTx1.hash)
    // const {status: statusTx2} = await withdrawalTx2.wait()

    // if (statusTx2 != 1) { throw "lame2" }

    await crossChainMessenger.waitForMessageStatus(withdrawalTx1.hash, optimismSDK.MessageStatus.READY_FOR_RELAY)
    const withdrawalTx3 = await crossChainMessenger.finalizeMessage(withdrawalTx1.hash)
    await withdrawalTx3.wait()  
    const {status: statusTx3} = await withdrawalTx3.wait()

    if (statusTx3 != 1) { throw "lame3" }
}

async function main() {
    await setupOP()
    // deployInitializeable()
    // deployL1Bridge()
    // deployL2Bridge()
    // sendGOR('.97')
    // deployL2ECO()
    // initializeL2ECO()
    // initializeL1Bridge()
    // approveAndDeposit()
    // rebaseCrossChain()
    // bridgeItBackNowYall()
    // checkInterface()
    await proveHash()
}

main()