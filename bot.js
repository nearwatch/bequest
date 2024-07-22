const fs        = require('fs') 
const crypto    = require('crypto')
const bs58      = require('bs58')
const Telegraf  = require('telegraf')
const bot       = new Telegraf(process.env.BOT_TOKEN,{handlerTimeout:100, telegram:{webhookReply:false}})
const polka    	= require('polka')
const bParser   = require('body-parser')
const nearApi 	= require('near-api-js')
const here      = require('./here')

const secret    = crypto.randomBytes(16).toString('hex')
const html      = fs.readFileSync('index.html','utf8').toString()
const net       = (accountId) => accountId?.endsWith('.testnet')?'testnet':'mainnet'
const getLink   = (account, heir) => 'https://t.me/'+process.env.TELEGRAM_APP+'?startapp='+bs58.encode(Buffer.from('?account='+account.toLowerCase()+(heir?'&heir='+heir.toLowerCase():'')))
const commonKB  = [{text:'User Manual', url:process.env.USER_MANUAL},{text:'Support', url:process.env.SUPPORT_GROUP}]

bot.hears(/^([a-z0-9][a-z0-9\.\-\_]+?\.(near|tg|testnet))\s*([a-z0-9][a-z0-9\.\-\_]+?\.(near|tg|testnet))?$/i, 
  ctx => ctx.reply('<code>'+ctx.match[1].toLowerCase()+'</code>\n'+(ctx.match[3]?'heir: <code>'+ctx.match[3].toLowerCase()+'</code>':''),{parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'Open App',url:getLink(ctx.match[1], ctx.match[3])}], commonKB]}}))
bot.on('message', ctx => ctx.reply('Send your Near account address to receive a personal link', {reply_markup:{inline_keyboard:[[{text:'Open App',url:'https://t.me/'+process.env.TELEGRAM_APP}], commonKB]}}))
bot.catch(err => console.error(err))
bot.telegram.setWebhook(process.env.DOMAIN+'/'+secret)
bot.telegram.getMe().then(console.log)

async function deployBequestContract(accountId, key, heirs, days) {
  try{
    const creds = nearApi.KeyPair.fromString(key);
    const networkId = net(accountId)
    const actions = [
      nearApi.transactions.deployContract(fs.readFileSync('bequest.wasm')),
      nearApi.transactions.functionCall('init', {heirs, days}, 10000000000000, 0),
      nearApi.transactions.deleteKey(nearApi.utils.PublicKey.fromString(creds.publicKey.toString()))
    ]
    const keyStore = new nearApi.keyStores.InMemoryKeyStore();
    keyStore.setKey(networkId, accountId, creds);
    const config = {keyStore, networkId, nodeUrl:'https://rpc.'+networkId+'.pagoda.co'}
    const near = await nearApi.connect({...config, keyStore})
    const account = await near.account(accountId)
    const tx = await account.signAndSendTransaction({receiverId:accountId, actions}) 
    return tx.status.Failure?{error:tx.status.Failure}:tx.transaction
  } catch(err) {
    console.log(err)
    const errtext = /panicked at \'(.+?)\'/.exec(err.toString())
    return {error:errtext?errtext[1]:err.type || err.toString()}
  }
}

const server = polka()
server.use(bot.webhookCallback('/'+secret), bParser.json())   
server.get('/',async (req,res) => {
	res.writeHead(200,{'Content-Type':'text/html'})	
	res.end(html) 
})
server.post('/create',async (req,res) => {
	res.writeHead(200,{'Content-Type':'application/json'})	
	if (!req.body || !req.body.account || !req.body.key) return res.end('{"error":"Wrong query"}')
	res.end(JSON.stringify(await here.createBequestAccount(req.body.account, req.body.key, req.body.only_key, req.body.signer))) 
})
server.post('/deploy',async (req,res) => {
	res.writeHead(200,{'Content-Type':'application/json'})	
	if (!req.body || !req.body.account || !req.body.key || !req.body.heirs?.length || !req.body.days) return res.end('{"error":"Wrong query"}')
	res.end(JSON.stringify(await deployBequestContract(req.body.account, req.body.key, req.body.heirs, +req.body.days))) 
})
server.listen(5000, err => console.log(err?err:'bequest service running...'))
