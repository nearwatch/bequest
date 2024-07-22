const bs58  = require('bs58')
const sha1  = require('sha1')
const uuid4 = require('uuid4')

const entry = "https://h4n.app"
const net   = (accountId) => accountId?.endsWith('.testnet')?'testnet':'mainnet'

const getPublicKeys = async (accountId, full=1, rpc='https://rpc.'+net(accountId)+'.pagoda.co') => {
  const res = await fetch(rpc, {method: "POST", body:JSON.stringify({jsonrpc:"2.0", id:"dontcare", method:"query", params:{request_type:"view_access_key_list", finality:"final", account_id:accountId}}), headers: {"content-type":"application/json"}})
  if (res.ok === false) return []
  const data = await res.json()
  return data.result.keys.filter(key => !full || (full==1 && key.access_key.permission=='FullAccess') || (full>1 && key.access_key.permission!='FullAccess'))
}
function baseEncode(value) {
  if (typeof value === "string") {
    const bytes = []
    for (let c = 0; c < value.length; c++) bytes.push(value.charCodeAt(c))
    value = new Uint8Array(bytes)
  }
  return bs58.encode(value)
}
getRequest = async (id) => {
  const res = await fetch(`${entry}/${id}/request`, {headers:{"content-type":"application/json"}})
  if (res.ok === false) throw Error(await res.text())
  const {data} = await res.json()
  return JSON.parse(Buffer.from(new Uint8Array(bs58.decode(data))).toString("utf8"))
}
getResponse = async (id) => {
  const res = await fetch(`${entry}/${id}/response`, {headers:{"content-type":"application/json"}})
  if (res.ok === false) throw Error(await res.text())
  const {data} = await res.json()
  return JSON.parse(data) ?? {}
}
deleteRequest = async (id) => {
  const res = await fetch(`${entry}/${id}`, {headers:{"content-type":"application/json" }, method:"DELETE"})
  if (res.ok === false) throw Error(await res.text())
}
computeRequestId = async (request) => {
  const query = baseEncode(JSON.stringify({...request, _id:uuid4()}))
  const hashsum = sha1(query)
  const id = Buffer.from(hashsum, "hex").toString("base64")
  const requestId = id.replaceAll("/", "_").replaceAll("-", "+").slice(0, 13);
  return {requestId, query};
}
createRequest = async (request) => {
  request.telegramApp = process.env.TELEGRAM_APP;
  const {requestId, query} = await computeRequestId(request);
  const res = await fetch(`${entry}/${requestId}/request`,{method:'POST', body:JSON.stringify({topic_id:'8cb6570c-b8bd-4415-b949-7d1ddbbbe2f8', data:query}), headers:{"content-type":"application/json"}})
  if (res.ok === false) throw Error(await res.text())
  return {url:'https://t.me/herewalletbot/app?startapp=h4n-'+bs58.encode(Buffer.from(requestId))}
}
exports.createBequestAccount = async (bequestId, func_key, only_key, signer) => {
  try{
    const signerId = signer ?? bequestId.split('.').slice(1).join('.')
    const list = await getPublicKeys(signerId)
    if (!list.length) return {error:'Keys were not copied from the owner account'}
    const transactions = [
      {
        signerId, 
        receiverId: bequestId, 
        actions: [
          {type:'CreateAccount'},
          {type:'Transfer', params:{deposit:'1110000000000000000000000'}},
          {type:'AddKey', params:{publicKey:func_key, accessKey:{permission:'FullAccess'}}},
        ].concat(list.slice(0,97).map(e => ({type:'AddKey', params:{publicKey:e.public_key, accessKey:{permission:'FullAccess'}}})))
      },
      {
        signerId, 
        receiverId: signerId, 
        actions: [{type:'AddKey', params:{publicKey:func_key, accessKey:{nonce:0, permission:{receiverId:bequestId, allowance:'250000000000000000000000', methodNames:[]}}}}] 
      }
    ]
    if (only_key) transactions.shift()
    return await createRequest({type:"call", network:net(signerId), transactions, selector:{id:signerId}})
  }catch(error){
    return {error:error.toString()}
  }
}
