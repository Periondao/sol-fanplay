export const truncateAddress = (
  addressString = '',
  initialDigits = 4,
  finalDigits = -4
) =>
  `${addressString.slice(0, initialDigits)}...${addressString.slice(
    finalDigits
  )}`
