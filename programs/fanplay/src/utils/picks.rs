use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;
use blake2::{Blake2b,Digest,digest::consts::U32};

use anchor_spl::token::Transfer;

use crate::utils::pick_struct::PlacePick;

pub fn place_pick(ctx: Context<PlacePick>, pick_spec: String, amount: u64) -> ProgramResult {
  let token_acc_balance = ctx.accounts.token_account.amount;
  let previous_hash = ctx.accounts.pool_account.picks_hash;

  // convert previous_hash to a String
  let previous_hash_str = format!("{:x}", previous_hash);
  // convert amount to a String
  let amount_str = format!("{:x}", amount);

  // concatenate previous_hash_str, pick_spec and amount_str
  let new_input_str = format!("{}{}{}", previous_hash_str, pick_spec, amount_str);

  type Blake2b32 = Blake2b<U32>;
  let mut hasher = Blake2b32::new();

  hasher.update(new_input_str.as_bytes());

  let hash_raw = hasher.finalize();

  let mut hash_u32 = [0u8; 4];
  hash_u32.copy_from_slice(&hash_raw[..4]);

  let transfer_ix = Transfer{
    from: ctx.accounts.user_ata.to_account_info(),
    to: ctx.accounts.token_account.to_account_info(),
    authority: ctx.accounts.user.to_account_info(),
  };

  let cpi_program = ctx.accounts.token_program.to_account_info();
  let cpi_ctx = CpiContext::new(cpi_program, transfer_ix);

  let transfer_result = anchor_spl::token::transfer(cpi_ctx, amount);

  if let Err(error) = transfer_result {
    msg!("Error: {:?}", error.to_string());
    // TODO: return a more specific error
    return Err(ProgramError::InvalidInstructionData);
  }

  let pool_account = &mut ctx.accounts.pool_account;
  
  pool_account.picks_hash = u32::from_le_bytes(hash_u32);
  pool_account.pick_count += 1;

  msg!("Account balance before bet: {}", token_acc_balance);
  msg!("Previous hash: {:?}", previous_hash);
  msg!("New hash: {:?}", pool_account.picks_hash);

  Ok(())
}
