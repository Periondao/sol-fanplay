use anchor_lang::prelude::*;

use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_lang::solana_program::rent::Rent;

declare_id!("Gwy5zyzMnHTi5CeASEEAHH3LdVtFe3urLZgNoxmMPMyJ");

#[program]
pub mod fanplay {
  use super::*;

  pub fn create_pool(ctx: Context<CreatePool>, pool_id: String, game_id: u32) -> ProgramResult {
    // TODO: check if pool_id has 32 bytes max    
    let pool_account = &mut ctx.accounts.pool_account;
    msg!("else {}", pool_account.key());
    pool_account.token_account = *ctx.accounts.pool_token_account.to_account_info().key;
    pool_account.admin_key = *ctx.accounts.pool_admin.key;
    pool_account.pool_id = pool_id;
    pool_account.game_id = game_id;
    pool_account.pool_total = 0;
    pool_account.pick_count = 0;

    Ok(())
  }

  pub fn place_pick(ctx: Context<PlacePick>, pick_spec: String, amount: u64) -> ProgramResult {
    let transfer_ix = Transfer{
      from: ctx.accounts.user_ata.to_account_info(),
      to: ctx.accounts.token_account.to_account_info(),
      authority: ctx.accounts.user.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, transfer_ix);

    // The return of ::invoke() could be an Err and should be handled
    let transfer_result = anchor_spl::token::transfer(cpi_ctx, amount);

    if let Err(error) = transfer_result {
      msg!("Error: {:?}", error.to_string());
      // TODO: return a more specific error
      return Err(ProgramError::InvalidInstructionData);
    }

    let user_pick = UserPick {
      user_key: *ctx.accounts.user.key,
      pick_spec,
      amount,
    };

    let pool_account = &mut ctx.accounts.pool_account;
    
    pool_account.picks.push(user_pick);
    pool_account.pool_total += amount;
    pool_account.pick_count += 1;

    Ok(())
  }

  pub fn payout(ctx: Context<Payout>, rake: u64, pool_bump: u8, payout_list: Vec<PayoutItem>) -> ProgramResult {
    let admin_token_account = &mut ctx.accounts.admin_token_account;
    let pool_token_account = &mut ctx.accounts.token_account;
    let pool_account = &mut ctx.accounts.pool_account;
    let winner_accounts = &ctx.remaining_accounts;
    let pool_admin = &mut ctx.accounts.pool_admin;

    if *pool_admin.key != pool_account.admin_key {
      msg!("User is not the admin of the pool");
      return Err(ProgramError::IncorrectProgramId);
    }

    if winner_accounts.len() != payout_list.len() {
      msg!("Number of winners does not match payout list");
      return Err(ProgramError::InvalidArgument);
    }

    // Iterate over payout list and get total amount to be paid
    let mut total_payout = 0;
    for payout in payout_list.iter() {
      total_payout += payout.amount;
    }

    let payouts_and_rake = total_payout + rake;

    if payouts_and_rake > pool_account.pool_total {
      return Err(ProgramError::InsufficientFunds);
    }

    // Pay out rake
    let cpi_accounts_rake = Transfer {
      from: pool_token_account.to_account_info().clone(),
      to: admin_token_account.to_account_info().clone(),
      authority: pool_account.to_account_info().clone(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();

    // Calculate seed to sign the transaction using pool_account
    let pool_id = pool_account.pool_id.clone();
    let game_id = &pool_account.game_id.to_le_bytes();
    let admin_key = pool_admin.key.as_ref();
    let seeds = &[pool_id.as_bytes(), game_id, admin_key, &[pool_bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
      cpi_program,
      cpi_accounts_rake,
      signer_seeds,
    );

    let rake_result = token::transfer(cpi_ctx, rake);

    if let Err(error) = rake_result {
      msg!("Error paying rake: {:?}", error.to_string());
      return Err(ProgramError::InvalidInstructionData);
    }

    // // To pay out winners, iterate over winner accounts,
    // // use its index to find the user_key in the payout_list,
    // // and transfer the amount to the winner
    // for (index, winner_acc) in winner_accounts.iter().enumerate() {
    //   let payout = payout_list.get(index).unwrap();
    //   let winner_key = *winner_acc.key;

    //   if payout.token_acc_key != winner_key {
    //     msg!("Order of winner accounts does not match order of payout list");
    //     return Err(ProgramError::InvalidArgument);
    //   }

    //   // Pay out winner USDC
    //   let cpi_accounts_payout = Transfer {
    //     from: pool_token_account.to_account_info(),
    //     to: winner_acc.to_account_info(),
    //     authority: pool_admin.to_account_info(),
    //   };

    //   let cpi_program = ctx.accounts.token_program.to_account_info();
    //   let cpi_ctx_payout = CpiContext::new(cpi_program, cpi_accounts_payout);
  
    //   token::transfer(cpi_ctx_payout, payout.amount);
    // }

    Ok(())
  }
}

#[derive(Accounts)]
#[instruction(pool_id: String, game_id: u32)]
pub struct CreatePool<'info> {
  #[account(mut)]
  pub pool_admin: Signer<'info>,

  #[account(
    init,
    payer = pool_admin,
    space = 732,
    seeds = [pool_id.as_bytes(), &game_id.to_le_bytes()[..], pool_admin.key().as_ref()],
    bump
  )]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub pool_token_account: Account<'info, TokenAccount>,

  pub mint_address: Account<'info, Mint>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UserPick {
  pub user_key: Pubkey, // 32 bytes
  pub pick_spec: String, // 4 bytes + size of string (lets max at 16 chars/bytes)
  // In SOL
  pub amount: u64, // 8 bytes
}
// Total size = 32 + (4 + 16) + 8 = 60 bytes

#[account]
pub struct PoolAccount {
  // QUESTION: Should this be a string? Is it easy to search for a pool by string?
  pub pool_id: String, // 4 bytes + size of string (lets max at 32 chars/bytes)
  pub game_id: u32, // 4 bytes
  // In SOL
  pub pool_total: u64, // 8 bytes
  pub pick_count: u32, // 4 bytes
  pub admin_key: Pubkey, // 32 bytes
  pub end_time: i64, // 8 bytes
  pub token_account: Pubkey, // 32 bytes
  pub picks: Vec<UserPick>, // 8 bytes + size of vector (lets max at 10 bets, 10 * 60 + 8 = 608 bytes)
}

// Up To token_acc => 4 + 32 + 16 + 32 + 8 + 32 = 124 bytes
// Total size => 124 + (8 + 600) = 732 bytes

// QUESTION: how much does it cost to store a pool_account for one month?
// would it be wise to save a replica of the pool_account on the DB,
// and maintain only a hash of that data on-chain?

#[derive(Accounts)]
pub struct PlacePick<'info> {
  #[account(mut)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub token_account: Account<'info, TokenAccount>,

  // TODO: Should this be a TokenAccount?
  #[account(mut)]
  pub user_ata: Account<'info, TokenAccount>,
  pub user: Signer<'info>,

  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct PayoutItem {
  pub user_token_account: Pubkey,
  pub user_key: Pubkey,
  pub amount: u64,
}

#[derive(Accounts)]
pub struct Payout<'info> {
  #[account(mut)]
  pub pool_account: Account<'info, PoolAccount>,

  #[account(mut)]
  pub token_account: Account<'info, TokenAccount>,

  #[account(mut)]
  pub pool_admin: Signer<'info>,

  #[account(mut)]
  pub admin_token_account: Account<'info, TokenAccount>,

  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token>,
}
