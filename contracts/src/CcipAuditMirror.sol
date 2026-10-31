// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {ExtraArgsCodec} from "@chainlink/contracts-ccip/contracts/libraries/ExtraArgsCodec.sol";

interface ILinkToken is IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title CcipAuditReceiver
 * @notice Receives PactRail audit anchors over Chainlink CCIP and stores the latest record per agreement.
 * @dev This adapter never moves escrow funds. It mirrors hashes so a settlement record can be
 *      independently observed on a second chain. Only the configured router, source chain, and
 *      source sender are accepted, and each CCIP message ID can be processed once.
 */
contract CcipAuditReceiver is CCIPReceiver {
    struct MirrorRecord {
        bytes32 agreementRef;
        bytes32 termsHash;
        bytes32 referenceHash;
        bytes32 eventKind;
        uint64 sourceChainSelector;
        uint64 receivedAt;
        bytes32 messageId;
        address sourceSender;
    }

    error UnauthorizedSourceChain(uint64 sourceChainSelector);
    error UnauthorizedSender(address sender);
    error MessageAlreadyProcessed(bytes32 messageId);
    error InvalidPayload();
    error InvalidSourceSender();

    event AuditMirrored(
        bytes32 indexed messageId,
        bytes32 indexed agreementRef,
        bytes32 termsHash,
        bytes32 referenceHash,
        bytes32 eventKind,
        uint64 sourceChainSelector,
        address indexed sourceSender,
        uint64 receivedAt
    );

    uint64 public immutable allowedSourceChainSelector;
    address public immutable allowedSourceSender;

    mapping(bytes32 => bool) public processedMessages;
    mapping(bytes32 => MirrorRecord) private _latestRecords;

    constructor(
        address router,
        uint64 sourceChainSelector_,
        address sourceSender_
    ) CCIPReceiver(router) {
        if (sourceSender_ == address(0)) revert InvalidSourceSender();
        allowedSourceChainSelector = sourceChainSelector_;
        allowedSourceSender = sourceSender_;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (message.sourceChainSelector != allowedSourceChainSelector) {
            revert UnauthorizedSourceChain(message.sourceChainSelector);
        }
        address sender = abi.decode(message.sender, (address));
        if (sender != allowedSourceSender) revert UnauthorizedSender(sender);
        if (processedMessages[message.messageId]) {
            revert MessageAlreadyProcessed(message.messageId);
        }
        if (message.data.length != 128) revert InvalidPayload();

        (bytes32 agreementRef, bytes32 termsHash, bytes32 referenceHash, bytes32 eventKind) =
            abi.decode(message.data, (bytes32, bytes32, bytes32, bytes32));

        processedMessages[message.messageId] = true;
        uint64 receivedAt = uint64(block.timestamp);
        _latestRecords[agreementRef] = MirrorRecord({
            agreementRef: agreementRef,
            termsHash: termsHash,
            referenceHash: referenceHash,
            eventKind: eventKind,
            sourceChainSelector: message.sourceChainSelector,
            receivedAt: receivedAt,
            messageId: message.messageId,
            sourceSender: sender
        });

        emit AuditMirrored(
            message.messageId,
            agreementRef,
            termsHash,
            referenceHash,
            eventKind,
            message.sourceChainSelector,
            sender,
            receivedAt
        );
    }

    function latestRecord(bytes32 agreementRef) external view returns (MirrorRecord memory) {
        return _latestRecords[agreementRef];
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

/**
 * @title CcipAuditSender
 * @notice Sends PactRail audit anchors to a CcipAuditReceiver on another chain.
 * @dev Fee payment uses LINK. The sender has no power over escrow funds.
 */
contract CcipAuditSender is Ownable {
    using SafeERC20 for IERC20;

    error InsufficientLink(uint256 required, uint256 available);
    error InvalidReceiver();
    error InvalidRouter();
    error InvalidLinkToken();

    event AuditAnchorSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed receiver,
        bytes32 agreementRef,
        bytes32 termsHash,
        bytes32 referenceHash,
        bytes32 eventKind,
        uint256 fee
    );

    IRouterClient public immutable router;
    IERC20 public immutable linkToken;
    uint64 public immutable destinationChainSelector;
    address public immutable receiver;

    constructor(
        address router_,
        address linkToken_,
        uint64 destinationChainSelector_,
        address receiver_
    ) Ownable(msg.sender) {
        if (router_ == address(0)) revert InvalidRouter();
        if (linkToken_ == address(0)) revert InvalidLinkToken();
        if (receiver_ == address(0)) revert InvalidReceiver();
        router = IRouterClient(router_);
        linkToken = IERC20(linkToken_);
        destinationChainSelector = destinationChainSelector_;
        receiver = receiver_;
    }

    function sendAuditAnchor(
        bytes32 agreementRef,
        bytes32 termsHash,
        bytes32 referenceHash,
        bytes32 eventKind
    ) external onlyOwner returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: abi.encode(agreementRef, termsHash, referenceHash, eventKind),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: ExtraArgsCodec._getBasicEncodedExtraArgsV3(200_000, bytes4(0)),
            feeToken: address(linkToken)
        });

        uint256 fee = router.getFee(destinationChainSelector, message);
        uint256 balance = linkToken.balanceOf(address(this));
        if (balance < fee) revert InsufficientLink(fee, balance);

        linkToken.forceApprove(address(router), fee);
        messageId = router.ccipSend(destinationChainSelector, message);

        emit AuditAnchorSent(
            messageId,
            destinationChainSelector,
            receiver,
            agreementRef,
            termsHash,
            referenceHash,
            eventKind,
            fee
        );
    }
}
