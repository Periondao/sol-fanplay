use anchor_lang::prelude::*;

#[account]
pub struct PoolAccount {
  // QUESTION: Should this be a string? Is it easy to search for a pool by string?
  pub pool_id: String, // 4 bytes + size of string (lets max at 16 chars/bytes)
  pub game_id: u32, // 4 bytes
  pub pick_count: u32, // 4 bytes
  pub picks_hash: u32, // 4 bytes => A hexadecimal hash with 8 chars
}
// Struct subtotal (4 + 16) + 4 + 4 + 4 = 32 bytes
// Total 32 + 8 (for discriminator) = 40 bytes

#[derive(Accounts)]
#[instruction(pool_id: String, game_id: u32)]
pub struct CreatePool<'info> {
  #[account(mut)]
  pub pool_admin: Signer<'info>,

  #[account(
    init,
    payer = pool_admin,
    space = 40,
    seeds = [pool_id.as_bytes(), &game_id.to_le_bytes()[..], pool_admin.key().as_ref()],
    bump
  )]
  pub pool_account: Account<'info, PoolAccount>,

  pub system_program: Program<'info, System>,
}
