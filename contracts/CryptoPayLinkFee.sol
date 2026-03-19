// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CryptoPayLinkFee
 * @notice Payment contract with percentage-based fee splitting.
 *         Each payment is split into a payee portion and a fee portion
 *         routed to a designated company wallet.
 *         Fee rate is expressed in basis points (max 1000 = 10%).
 */
contract CryptoPayLinkFee is Ownable {
    using SafeERC20 for IERC20;

    // ---- State ----

    address public companyWallet;
    uint256 public feeRate; // basis points, max 1000 (10%)

    // ---- Events ----

    event NativePayment(
        address indexed payer,
        address indexed payee,
        uint256 totalAmount,
        uint256 feeAmount,
        uint256 netAmount,
        string memo
    );

    event TokenPayment(
        address indexed payer,
        address indexed payee,
        address indexed token,
        uint256 totalAmount,
        uint256 feeAmount,
        uint256 netAmount,
        string memo
    );

    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event CompanyWalletUpdated(address oldWallet, address newWallet);

    // ---- Constructor ----

    constructor(address _companyWallet, uint256 _feeRate) Ownable(msg.sender) {
        require(_companyWallet != address(0), "Invalid company wallet");
        require(_feeRate <= 1000, "Fee rate exceeds maximum");
        companyWallet = _companyWallet;
        feeRate = _feeRate;
    }

    // ---- Payment functions ----

    /**
     * @notice Pay with native ETH. Fee is split to company wallet.
     * @param payee  Recipient address
     * @param memo   Optional note
     */
    function payNative(address payable payee, string calldata memo)
        external
        payable
    {
        require(msg.value > 0, "Amount must be > 0");
        require(payee != address(0), "Invalid payee");

        uint256 feeAmount = (msg.value * feeRate) / 10000;
        uint256 netAmount = msg.value - feeAmount;

        (bool payeeOk,) = payee.call{value: netAmount}("");
        require(payeeOk, "Payee transfer failed");

        if (feeAmount > 0) {
            (bool feeOk,) = companyWallet.call{value: feeAmount}("");
            require(feeOk, "Fee transfer failed");
        }

        emit NativePayment(msg.sender, payee, msg.value, feeAmount, netAmount, memo);
    }

    /**
     * @notice Pay with any ERC-20 token. Fee is split to company wallet.
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

        uint256 feeAmount = (amount * feeRate) / 10000;
        uint256 netAmount = amount - feeAmount;

        IERC20(token).safeTransferFrom(msg.sender, payee, netAmount);

        if (feeAmount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, companyWallet, feeAmount);
        }

        emit TokenPayment(msg.sender, payee, token, amount, feeAmount, netAmount, memo);
    }

    // ---- Admin functions ----

    /**
     * @notice Update the fee rate. Only callable by the contract owner.
     * @param _feeRate New fee rate in basis points (max 1000)
     */
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee rate exceeds maximum");
        uint256 oldRate = feeRate;
        feeRate = _feeRate;
        emit FeeRateUpdated(oldRate, _feeRate);
    }

    /**
     * @notice Update the company wallet address. Only callable by the contract owner.
     * @param _companyWallet New company wallet address
     */
    function setCompanyWallet(address _companyWallet) external onlyOwner {
        require(_companyWallet != address(0), "Invalid company wallet");
        address oldWallet = companyWallet;
        companyWallet = _companyWallet;
        emit CompanyWalletUpdated(oldWallet, _companyWallet);
    }
}
