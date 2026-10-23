// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CryptoPayLink
 * @notice Trustless, feeless transfer contract. 100% of funds go to the payee.
 */
contract CryptoPayLink {
    using SafeERC20 for IERC20;

    event NativePayment(
        address indexed payer,
        address indexed payee,
        uint256 amount,
        string memo
    );

    event TokenPayment(
        address indexed payer,
        address indexed payee,
        address indexed token,
        uint256 amount,
        string memo
    );

    /**
     * @notice Send native ETH to a payee.
     * @param payee  Recipient address.
     * @param memo   Optional memo string.
     */
    function payNative(address payable payee, string calldata memo) external payable {
        require(msg.value > 0, "Amount must be > 0");
        payee.transfer(msg.value);
        emit NativePayment(msg.sender, payee, msg.value, memo);
    }

    /**
     * @notice Send ERC-20 tokens to a payee.
     * @param payee   Recipient address.
     * @param token   ERC-20 token contract address.
     * @param amount  Token amount (in token's smallest unit).
     * @param memo    Optional memo string.
     */
    function payToken(
        address payee,
        address token,
        uint256 amount,
        string calldata memo
    ) external {
        require(amount > 0, "Amount must be > 0");
        IERC20(token).safeTransferFrom(msg.sender, payee, amount);
        emit TokenPayment(msg.sender, payee, token, amount, memo);
    }
}
