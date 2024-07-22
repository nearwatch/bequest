use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{near_bindgen, env, AccountId, PublicKey, PanicOnDefault, Promise, ONE_NEAR};
use near_sdk::collections::UnorderedSet;
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
  heirs: UnorderedSet<AccountId>,
  days : u64,
  last : u64,
  balance: u128
}
fn get_balance() -> u128 {
  env::account_balance()*1000/ONE_NEAR*1_000_000_000_000_000_000_000
}
#[near_bindgen]
impl Contract {
  #[init]
  #[private]
  pub fn init(heirs:Vec<AccountId>, days:u64) -> Self {
    let mut set: UnorderedSet<AccountId> = UnorderedSet::new(b"s");
    heirs.iter().for_each(|e| {set.insert(e);});
    Self {heirs: set, days, last:env::block_timestamp().to_string()[..10].parse::<u64>().unwrap(), balance:get_balance()}
  }
  pub fn delete(&mut self){
    assert!(env::current_account_id().as_str().strip_suffix(env::predecessor_account_id().as_str()).and_then(|s| s.strip_suffix('.')).map_or(false, |s| !s.contains('.')), "No access");
    Promise::new(env::current_account_id()).delete_account(env::predecessor_account_id());
  }
  pub fn alive(&mut self){
    assert!(env::current_account_id().as_str().strip_suffix(env::predecessor_account_id().as_str()).and_then(|s| s.strip_suffix('.')).map_or(false, |s| !s.contains('.')), "No access");
    self.last = env::block_timestamp().to_string()[..10].parse::<u64>().unwrap();
    self.balance = get_balance(); 
  }
  pub fn unlock(&mut self, public_key:PublicKey) -> String {
    assert!(self.heirs.contains(&env::predecessor_account_id()),"No access");
    let changed = self.balance > get_balance();
    if self.balance != get_balance() {
      env::log_str(&format!("Save new balance. Old balance:{}, current balance:{}", self.balance, get_balance()));
      self.balance = get_balance();
    }
    let now = env::block_timestamp().to_string()[..10].parse::<u64>().unwrap();
    if now-self.last < self.days*86400 {
      panic!("Owner is still alive. Last activity was {} days ago", (now-self.last)/86400);
    }
    if changed {
      self.balance = get_balance();
      panic!("A balance discrepancy has been detected, perhaps this is due to the owner’s activity. Time until unlocking extended by {} days", self.days);
    }
    Promise::new(env::current_account_id()).add_full_access_key(public_key);
    env::log_str(&format!("{} unlocked {} ", env::predecessor_account_id(), env::current_account_id()));
    "Key was added. You can import account to a wallet".to_string()
  }
  pub fn state(&self) -> (Vec<String>, u64, u64, String, String) {
    (self.heirs.iter().map(|e| e.to_string()).collect(), self.days, self.last, self.balance.to_string(), env::account_balance().to_string())
  }
}
