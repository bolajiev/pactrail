// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgreementEscrow
 * @notice Milestone escrow for bilateral commercial agreements on test networks.
 * @dev Terms are stored as a hash. Milestone descriptions and documents remain off-chain.
 *      There is no owner, admin withdrawal path, or upgrade mechanism.
 */
contract AgreementEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_MILESTONES = 32;
    uint256 public constant MAX_EVIDENCE_URI_LENGTH = 512;

    enum AgreementStatus {
        None,
        Created,
        Funded,
        Completed
    }

    enum MilestoneStatus {
        None,
        Pending,
        Submitted,
        Released,
        Disputed,
        Resolved
    }

    struct Agreement {
        address payer;
        address payee;
        address arbitrator;
        address token;
        uint256 totalAmount;
        bytes32 termsHash;
        uint64 createdAt;
        uint64 fundedAt;
        AgreementStatus status;
    }

    struct Milestone {
        uint256 amount;
        uint64 dueAt;
        MilestoneStatus status;
        bytes32 evidenceHash;
        string evidenceUri;
        uint64 submittedAt;
        uint64 resolvedAt;
        uint256 releasedAmount;
        uint256 refundedAmount;
        bytes32 disputeReasonHash;
    }

    error InvalidAddress();
    error InvalidAmount();
    error InvalidMilestoneCount();
    error InvalidMilestoneSum(uint256 expected, uint256 actual);
    error InvalidDueDate(uint256 index);
    error InvalidTermsHash();
    error InvalidStatus();
    error InvalidMilestone();
    error Unauthorized();
    error EvidenceAlreadySubmitted();
    error InvalidEvidenceHash();
    error EvidenceUriTooLong();
    error InvalidResolution();
    error InvalidDisputeReason();
    error TokenTransferMismatch(uint256 expected, uint256 received);

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed payer,
        address indexed payee,
        address arbitrator,
        address token,
        uint256 totalAmount,
        bytes32 termsHash,
        uint256 milestoneCount
    );
    event AgreementFunded(uint256 indexed agreementId, address indexed payer, uint256 amount);
    event EvidenceSubmitted(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        bytes32 evidenceHash,
        string evidenceUri,
        uint64 submittedAt
    );
    event MilestoneApproved(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed payer,
        address payee,
        uint256 amount
    );
    event DisputeRaised(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed raisedBy,
        bytes32 reasonHash
    );
    event DisputeResolved(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed arbitrator,
        uint256 payeeAmount,
        uint256 payerRefundAmount
    );
    event RefundIssued(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed payer,
        uint256 amount
    );
    event AgreementCompleted(uint256 indexed agreementId, uint64 completedAt);

    uint256 public nextAgreementId = 1;

    mapping(uint256 => Agreement) private _agreements;
    mapping(uint256 => Milestone[]) private _milestones;

    modifier agreementExists(uint256 agreementId) {
        if (_agreements[agreementId].status == AgreementStatus.None) revert InvalidStatus();
        _;
    }

    modifier milestoneExists(uint256 agreementId, uint256 milestoneId) {
        if (milestoneId >= _milestones[agreementId].length) revert InvalidMilestone();
        _;
    }

    /**
     * @notice Creates an unfunded agreement and its milestone schedule.
     * @dev The caller must be the payer. Terms hash binds the human-approved off-chain terms.
     */
    function createAgreement(
        address payee,
        address arbitrator,
        address token,
        uint256 totalAmount,
        bytes32 termsHash,
        uint64[] calldata dueAts,
        uint256[] calldata amounts
    ) external returns (uint256 agreementId) {
        address payer = msg.sender;

        if (
            payer == address(0) || payee == address(0) || arbitrator == address(0)
                || token == address(0)
        ) revert InvalidAddress();
        if (payee == payer || arbitrator == payer || arbitrator == payee) revert InvalidAddress();
        if (totalAmount == 0) revert InvalidAmount();
        if (termsHash == bytes32(0)) revert InvalidTermsHash();

        uint256 count = amounts.length;
        if (count == 0 || count > MAX_MILESTONES) revert InvalidMilestoneCount();
        if (dueAts.length != count) revert InvalidMilestoneCount();

        uint256 sum;
        for (uint256 i; i < count; ++i) {
            if (amounts[i] == 0) revert InvalidAmount();
            if (dueAts[i] <= block.timestamp) revert InvalidDueDate(i);
            sum += amounts[i];
        }
        if (sum != totalAmount) revert InvalidMilestoneSum(totalAmount, sum);

        agreementId = nextAgreementId++;
        _agreements[agreementId] = Agreement({
            payer: payer,
            payee: payee,
            arbitrator: arbitrator,
            token: token,
            totalAmount: totalAmount,
            termsHash: termsHash,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            status: AgreementStatus.Created
        });

        for (uint256 i; i < count; ++i) {
            _milestones[agreementId].push(
                Milestone({
                    amount: amounts[i],
                    dueAt: dueAts[i],
                    status: MilestoneStatus.Pending,
                    evidenceHash: bytes32(0),
                    evidenceUri: "",
                    submittedAt: 0,
                    resolvedAt: 0,
                    releasedAmount: 0,
                    refundedAmount: 0,
                    disputeReasonHash: bytes32(0)
                })
            );
        }

        emit AgreementCreated(
            agreementId,
            payer,
            payee,
            arbitrator,
            token,
            totalAmount,
            termsHash,
            count
        );
    }

    /**
     * @notice Payer deposits the full agreement total in the agreed ERC-20 token.
     */
    function fundAgreement(uint256 agreementId)
        external
        nonReentrant
        agreementExists(agreementId)
    {
        Agreement storage agreement = _agreements[agreementId];
        if (msg.sender != agreement.payer) revert Unauthorized();
        if (agreement.status != AgreementStatus.Created) revert InvalidStatus();

        IERC20 token = IERC20(agreement.token);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), agreement.totalAmount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received != agreement.totalAmount) {
            revert TokenTransferMismatch(agreement.totalAmount, received);
        }

        agreement.status = AgreementStatus.Funded;
        agreement.fundedAt = uint64(block.timestamp);

        emit AgreementFunded(agreementId, msg.sender, agreement.totalAmount);
    }

    /**
     * @notice Payee submits a hash and optional short reference for milestone evidence.
     */
    function submitMilestoneEvidence(
        uint256 agreementId,
        uint256 milestoneId,
        bytes32 evidenceHash,
        string calldata evidenceUri
    )
        external
        agreementExists(agreementId)
        milestoneExists(agreementId, milestoneId)
    {
        Agreement storage agreement = _agreements[agreementId];
        if (msg.sender != agreement.payee) revert Unauthorized();
        if (agreement.status != AgreementStatus.Funded) revert InvalidStatus();
        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();
        if (bytes(evidenceUri).length > MAX_EVIDENCE_URI_LENGTH) revert EvidenceUriTooLong();

        Milestone storage milestone = _milestones[agreementId][milestoneId];
        if (milestone.status != MilestoneStatus.Pending) revert EvidenceAlreadySubmitted();

        milestone.status = MilestoneStatus.Submitted;
        milestone.evidenceHash = evidenceHash;
        milestone.evidenceUri = evidenceUri;
        milestone.submittedAt = uint64(block.timestamp);

        emit EvidenceSubmitted(
            agreementId, milestoneId, evidenceHash, evidenceUri, uint64(block.timestamp)
        );
    }

    /**
     * @notice Payer approves submitted evidence and releases exactly the milestone amount.
     */
    function approveMilestone(uint256 agreementId, uint256 milestoneId)
        external
        nonReentrant
        agreementExists(agreementId)
        milestoneExists(agreementId, milestoneId)
    {
        Agreement storage agreement = _agreements[agreementId];
        if (msg.sender != agreement.payer) revert Unauthorized();
        if (agreement.status != AgreementStatus.Funded) revert InvalidStatus();

        Milestone storage milestone = _milestones[agreementId][milestoneId];
        if (milestone.status != MilestoneStatus.Submitted) revert InvalidStatus();

        milestone.status = MilestoneStatus.Released;
        milestone.releasedAmount = milestone.amount;
        milestone.resolvedAt = uint64(block.timestamp);

        IERC20(agreement.token).safeTransfer(agreement.payee, milestone.amount);

        emit MilestoneApproved(
            agreementId, milestoneId, msg.sender, agreement.payee, milestone.amount
        );
        _completeIfSettled(agreementId, agreement);
    }

    /**
     * @notice Payer or payee freezes a pending or submitted milestone for arbitrator review.
     */
    function raiseDispute(uint256 agreementId, uint256 milestoneId, bytes32 reasonHash)
        external
        agreementExists(agreementId)
        milestoneExists(agreementId, milestoneId)
    {
        Agreement storage agreement = _agreements[agreementId];
        if (msg.sender != agreement.payer && msg.sender != agreement.payee) revert Unauthorized();
        if (agreement.status != AgreementStatus.Funded) revert InvalidStatus();
        if (reasonHash == bytes32(0)) revert InvalidDisputeReason();

        Milestone storage milestone = _milestones[agreementId][milestoneId];
        if (
            milestone.status != MilestoneStatus.Pending
                && milestone.status != MilestoneStatus.Submitted
        ) revert InvalidStatus();

        milestone.status = MilestoneStatus.Disputed;
        milestone.disputeReasonHash = reasonHash;

        emit DisputeRaised(agreementId, milestoneId, msg.sender, reasonHash);
    }

    /**
     * @notice Arbitrator resolves a disputed milestone by splitting its exact amount.
     */
    function resolveDispute(
        uint256 agreementId,
        uint256 milestoneId,
        uint256 payeeAmount,
        uint256 payerRefundAmount
    )
        external
        nonReentrant
        agreementExists(agreementId)
        milestoneExists(agreementId, milestoneId)
    {
        Agreement storage agreement = _agreements[agreementId];
        if (msg.sender != agreement.arbitrator) revert Unauthorized();
        if (agreement.status != AgreementStatus.Funded) revert InvalidStatus();

        Milestone storage milestone = _milestones[agreementId][milestoneId];
        if (milestone.status != MilestoneStatus.Disputed) revert InvalidStatus();
        if (payeeAmount + payerRefundAmount != milestone.amount) revert InvalidResolution();

        milestone.status = MilestoneStatus.Resolved;
        milestone.releasedAmount = payeeAmount;
        milestone.refundedAmount = payerRefundAmount;
        milestone.resolvedAt = uint64(block.timestamp);

        IERC20 token = IERC20(agreement.token);
        if (payeeAmount > 0) token.safeTransfer(agreement.payee, payeeAmount);
        if (payerRefundAmount > 0) {
            token.safeTransfer(agreement.payer, payerRefundAmount);
            emit RefundIssued(agreementId, milestoneId, agreement.payer, payerRefundAmount);
        }

        emit DisputeResolved(
            agreementId, milestoneId, msg.sender, payeeAmount, payerRefundAmount
        );
        _completeIfSettled(agreementId, agreement);
    }

    function getAgreement(uint256 agreementId)
        external
        view
        agreementExists(agreementId)
        returns (Agreement memory)
    {
        return _agreements[agreementId];
    }

    function getMilestone(uint256 agreementId, uint256 milestoneId)
        external
        view
        agreementExists(agreementId)
        milestoneExists(agreementId, milestoneId)
        returns (Milestone memory)
    {
        return _milestones[agreementId][milestoneId];
    }

    function getMilestones(uint256 agreementId)
        external
        view
        agreementExists(agreementId)
        returns (Milestone[] memory)
    {
        return _milestones[agreementId];
    }

    function milestoneCount(uint256 agreementId)
        external
        view
        agreementExists(agreementId)
        returns (uint256)
    {
        return _milestones[agreementId].length;
    }

    function _completeIfSettled(uint256 agreementId, Agreement storage agreement) private {
        Milestone[] storage milestones = _milestones[agreementId];
        for (uint256 i; i < milestones.length; ++i) {
            MilestoneStatus status = milestones[i].status;
            if (status != MilestoneStatus.Released && status != MilestoneStatus.Resolved) {
                return;
            }
        }
        agreement.status = AgreementStatus.Completed;
        emit AgreementCompleted(agreementId, uint64(block.timestamp));
    }
}
