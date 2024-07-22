# Bequest contract
### Build
```
$ cargo build --target wasm32-unknown-unknown --release
$ copy target\wasm32-unknown-unknown\release\bequest.wasm bequest.wasm 
```
### Deploy
```
$ near deploy bequest.wasm account.near
```

### Initialization
```
near call will.account.near init {\"heirs\":[\"daughter.account.near\",\"son.account.near\"],\"days\":30} --accountId account.near
```

### Support
<a href="https://t.me/near_bequest">Bequest support group (telegram)</a>
