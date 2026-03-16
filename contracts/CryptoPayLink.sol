// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CryptoPayLink
 * @notice PromptPay-style payment contract for crypto.
 *         Payer sends tokens directly to payee — contract just emits events for tracking.
 *         No funds are held in the contract (trustless).
 */
contract CryptoPayLink {
    using SafeERC20 for IERC20;

    // ---- Events ----

    event NativePayment(
        address indexed payer,
        address indexed payee,
        uint256 amount,
        string  memo
    );

    event TokenPayment(
        address indexed payer,
        address indexed payee,
        address indexed token,
        uint256 amount,
        string  memo
    );

    // ---- External functions ----

    /**
     * @notice Pay with native ETH.
     * @param payee  Recipient address
     * @param memo   Optional note (e.g. "ค่าข้าว")
     */
    function payNative(address payable payee, string calldata memo)
        external
        payable
    {
        require(msg.value > 0, "Amount must be > 0");
        require(payee != address(0), "Invalid payee");

        // Direct transfer — no custody
        (bool ok,) = payee.call{value: msg.value}("");
        require(ok, "Transfer failed");

        emit NativePayment(msg.sender, payee, msg.value, memo);
    }

    /**
     * @notice Pay with any ERC-20 token.
     * @param payee   Recipient address
     * @param token   ERC-20 token contract address
     * @param amount  Token amount (in token's native decimals)
     * @param memo    Optional note
     */
    function payToken(
        address payee,
        address token,
        uint256 amount,
        string calldata memo
    ) external {
        require(amount > 0, "Amount must be > 0");
        require(payee != address(0), "Invalid payee");
        require(token != address(0), "Invalid token");

        // Pull from sender, push to payee — no middleman
        IERC20(token).safeTransferFrom(msg.sender, payee, amount);

        emit TokenPayment(msg.sender, payee, token, amount, memo);
    }
}
