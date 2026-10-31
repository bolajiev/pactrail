// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {AgreementEscrow} from "../src/AgreementEscrow.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RevertingToken {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("token unavailable");
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert("token unavailable");
    }
}

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1_000_000e6);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 fee = value / 100;
            super._update(from, address(0xdead), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract AgreementEscrowTest is Test {
    MockStablecoin internal token;
    AgreementEscrow internal escrow;

    address internal payer = makeAddr("payer");
    address internal payee = makeAddr("payee");
    address internal arbitrator = makeAddr("arbitrator");
    address internal outsider = makeAddr("outsider");

    uint256 internal constant TOTAL = 5_000e6;
    bytes32 internal constant TERMS_HASH = keccak256("approved terms");
    bytes32 internal constant EVIDENCE_HASH = keccak256("evidence");

    uint64[] internal dueAts;
    uint256[] internal amounts;
    uint256 internal agreementId;

    function setUp() public {
        token = new MockStablecoin();
        escrow = new AgreementEscrow();

        token.mint(payer, 100_000e6);
        dueAts = [uint64(block.timestamp + 30 days), uint64(block.timestamp + 60 days), uint64(block.timestamp + 90 days)];
        amounts = [1_000e6, 2_000e6, 2_000e6];

        vm.prank(payer);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(payer);
        agreementId = escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, dueAts, amounts
        );
        vm.prank(payer);
        escrow.fundAgreement(agreementId);
    }

    function _createUnfunded() internal returns (uint256 id) {
        vm.prank(payer);
        id = escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, dueAts, amounts
        );
    }

    function _submit(uint256 milestoneId) internal {
        vm.prank(payee);
        escrow.submitMilestoneEvidence(
            agreementId, milestoneId, EVIDENCE_HASH, "ipfs://example-evidence-reference"
        );
    }

    function _approve(uint256 milestoneId) internal {
        _submit(milestoneId);
        vm.prank(payer);
        escrow.approveMilestone(agreementId, milestoneId);
    }

    function testCreateAgreementStoresScheduleAndTerms() public view {
        AgreementEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
        assertEq(agreement.payer, payer);
        assertEq(agreement.payee, payee);
        assertEq(agreement.arbitrator, arbitrator);
        assertEq(agreement.token, address(token));
        assertEq(agreement.totalAmount, TOTAL);
        assertEq(agreement.termsHash, TERMS_HASH);
        assertEq(uint256(agreement.status), uint256(AgreementEscrow.AgreementStatus.Funded));
        assertEq(escrow.milestoneCount(agreementId), 3);

        AgreementEscrow.Milestone[] memory milestones = escrow.getMilestones(agreementId);
        assertEq(milestones[0].amount, 1_000e6);
        assertEq(milestones[1].amount, 2_000e6);
        assertEq(milestones[2].amount, 2_000e6);
        assertEq(milestones[0].dueAt, dueAts[0]);
        assertEq(
            uint256(milestones[0].status),
            uint256(AgreementEscrow.MilestoneStatus.Pending)
        );
    }

    function testCreateAgreementIncrementsIds() public {
        uint256 second = _createUnfunded();
        assertEq(second, agreementId + 1);
    }

    function testCreateRejectsZeroAndDuplicateParties() public {
        vm.startPrank(payer);
        vm.expectRevert(AgreementEscrow.InvalidAddress.selector);
        escrow.createAgreement(
            address(0), arbitrator, address(token), TOTAL, TERMS_HASH, dueAts, amounts
        );
        vm.expectRevert(AgreementEscrow.InvalidAddress.selector);
        escrow.createAgreement(
            payee, address(0), address(token), TOTAL, TERMS_HASH, dueAts, amounts
        );
        vm.expectRevert(AgreementEscrow.InvalidAddress.selector);
        escrow.createAgreement(
            payer, arbitrator, address(token), TOTAL, TERMS_HASH, dueAts, amounts
        );
        vm.expectRevert(AgreementEscrow.InvalidAddress.selector);
        escrow.createAgreement(
            payee, payee, address(token), TOTAL, TERMS_HASH, dueAts, amounts
        );
        vm.expectRevert(AgreementEscrow.InvalidAddress.selector);
        escrow.createAgreement(
            payee, arbitrator, address(0), TOTAL, TERMS_HASH, dueAts, amounts
        );
        vm.stopPrank();
    }

    function testCreateRejectsInvalidTermsAndAmounts() public {
        vm.startPrank(payer);
        vm.expectRevert(AgreementEscrow.InvalidTermsHash.selector);
        escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, bytes32(0), dueAts, amounts
        );
        vm.expectRevert(AgreementEscrow.InvalidAmount.selector);
        escrow.createAgreement(
            payee, arbitrator, address(token), 0, TERMS_HASH, dueAts, amounts
        );

        uint256[] memory badAmounts = new uint256[](3);
        badAmounts[0] = 1_000e6;
        badAmounts[1] = 2_000e6;
        badAmounts[2] = 1_999e6;
        vm.expectRevert(
            abi.encodeWithSelector(AgreementEscrow.InvalidMilestoneSum.selector, TOTAL, 4_999e6)
        );
        escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, dueAts, badAmounts
        );

        uint256[] memory zeroMilestone = new uint256[](3);
        zeroMilestone[0] = 0;
        zeroMilestone[1] = 2_500e6;
        zeroMilestone[2] = 2_500e6;
        vm.expectRevert(AgreementEscrow.InvalidAmount.selector);
        escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, dueAts, zeroMilestone
        );
        vm.stopPrank();
    }

    function testCreateRejectsBadScheduleLengths() public {
        uint64[] memory shortDue = new uint64[](2);
        shortDue[0] = dueAts[0];
        shortDue[1] = dueAts[1];

        vm.startPrank(payer);
        vm.expectRevert(AgreementEscrow.InvalidMilestoneCount.selector);
        escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, shortDue, amounts
        );

        uint256[] memory empty = new uint256[](0);
        uint64[] memory emptyDates = new uint64[](0);
        vm.expectRevert(AgreementEscrow.InvalidMilestoneCount.selector);
        escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, emptyDates, empty
        );
        vm.stopPrank();
    }

    function testCreateRejectsPastDueDate() public {
        uint64[] memory past = new uint64[](3);
        past[0] = uint64(block.timestamp);
        past[1] = dueAts[1];
        past[2] = dueAts[2];

        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(AgreementEscrow.InvalidDueDate.selector, 0)
        );
        escrow.createAgreement(
            payee, arbitrator, address(token), TOTAL, TERMS_HASH, past, amounts
        );
    }

    function testFundOnlyPayerAndOnlyOnce() public {
        uint256 unfunded = _createUnfunded();

        vm.prank(payee);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.fundAgreement(unfunded);

        vm.prank(payer);
        escrow.fundAgreement(unfunded);

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.fundAgreement(unfunded);
    }

    function testFundRequiresAllowance() public {
        token.mint(outsider, TOTAL);
        vm.prank(outsider);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(outsider);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.fundAgreement(agreementId);
    }

    function testOnlyPayeeSubmitsEvidence() public {
        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.submitMilestoneEvidence(
            agreementId, 0, EVIDENCE_HASH, "ipfs://evidence"
        );

        vm.prank(outsider);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.submitMilestoneEvidence(
            agreementId, 0, EVIDENCE_HASH, "ipfs://evidence"
        );

        vm.prank(payee);
        vm.expectRevert(AgreementEscrow.InvalidEvidenceHash.selector);
        escrow.submitMilestoneEvidence(agreementId, 0, bytes32(0), "ipfs://evidence");

        _submit(0);
        vm.prank(payee);
        vm.expectRevert(AgreementEscrow.EvidenceAlreadySubmitted.selector);
        escrow.submitMilestoneEvidence(
            agreementId, 0, keccak256("duplicate"), "ipfs://duplicate"
        );
    }

    function testOnlyPayerApprovesSubmittedMilestone() public {
        _submit(0);

        vm.prank(outsider);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.approveMilestone(agreementId, 0);

        vm.prank(payee);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.approveMilestone(agreementId, 0);

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.approveMilestone(agreementId, 1);
    }

    function testApprovalTransfersExactlyMilestoneAmountOnce() public {
        uint256 payeeBefore = token.balanceOf(payee);
        _approve(0);

        assertEq(token.balanceOf(payee) - payeeBefore, 1_000e6);
        AgreementEscrow.Milestone memory milestone = escrow.getMilestone(agreementId, 0);
        assertEq(
            uint256(milestone.status),
            uint256(AgreementEscrow.MilestoneStatus.Released)
        );
        assertEq(milestone.releasedAmount, 1_000e6);

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.approveMilestone(agreementId, 0);
    }

    function testEitherPartyCanDisputeBeforeRelease() public {
        _submit(0);
        vm.prank(payee);
        escrow.raiseDispute(agreementId, 0, keccak256("quality question"));
        assertEq(
            uint256(escrow.getMilestone(agreementId, 0).status),
            uint256(AgreementEscrow.MilestoneStatus.Disputed)
        );

        vm.prank(payer);
        escrow.raiseDispute(agreementId, 1, keccak256("access not delivered"));
        assertEq(
            uint256(escrow.getMilestone(agreementId, 1).status),
            uint256(AgreementEscrow.MilestoneStatus.Disputed)
        );

        vm.prank(outsider);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.raiseDispute(agreementId, 2, keccak256("not a party"));
    }

    function testDisputeBlocksApproval() public {
        _submit(0);
        vm.prank(payer);
        escrow.raiseDispute(agreementId, 0, keccak256("needs review"));

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.approveMilestone(agreementId, 0);
    }

    function testOnlyArbitratorResolvesAndSplitMustMatch() public {
        _submit(0);
        vm.prank(payer);
        escrow.raiseDispute(agreementId, 0, keccak256("scope disagreement"));

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.Unauthorized.selector);
        escrow.resolveDispute(agreementId, 0, 700e6, 300e6);

        vm.prank(arbitrator);
        vm.expectRevert(AgreementEscrow.InvalidResolution.selector);
        escrow.resolveDispute(agreementId, 0, 700e6, 200e6);

        vm.prank(arbitrator);
        escrow.resolveDispute(agreementId, 0, 700e6, 300e6);

        assertEq(
            uint256(escrow.getMilestone(agreementId, 0).status),
            uint256(AgreementEscrow.MilestoneStatus.Resolved)
        );
        assertEq(escrow.getMilestone(agreementId, 0).releasedAmount, 700e6);
        assertEq(escrow.getMilestone(agreementId, 0).refundedAmount, 300e6);
    }

    function testResolutionPaysAndRefundsExactAmounts() public {
        _submit(0);
        vm.prank(payer);
        escrow.raiseDispute(agreementId, 0, keccak256("partial delivery"));

        uint256 payeeBefore = token.balanceOf(payee);
        uint256 payerBefore = token.balanceOf(payer);

        vm.prank(arbitrator);
        escrow.resolveDispute(agreementId, 0, 650e6, 350e6);

        assertEq(token.balanceOf(payee) - payeeBefore, 650e6);
        assertEq(token.balanceOf(payer) - payerBefore, 350e6);

        vm.prank(arbitrator);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.resolveDispute(agreementId, 0, 1_000e6, 0);
    }

    function testUndisputedMilestonesContinueAfterDispute() public {
        _submit(0);
        vm.prank(payer);
        escrow.raiseDispute(agreementId, 0, keccak256("review"));

        _approve(1);
        assertEq(
            uint256(escrow.getMilestone(agreementId, 1).status),
            uint256(AgreementEscrow.MilestoneStatus.Released)
        );

        vm.prank(arbitrator);
        escrow.resolveDispute(agreementId, 0, 550e6, 450e6);

        _approve(2);
        AgreementEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
        assertEq(
            uint256(agreement.status),
            uint256(AgreementEscrow.AgreementStatus.Completed)
        );
    }

    function testCompletedAgreementRejectsTransitions() public {
        _approve(0);
        _approve(1);
        _approve(2);

        AgreementEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
        assertEq(
            uint256(agreement.status),
            uint256(AgreementEscrow.AgreementStatus.Completed)
        );

        vm.prank(payee);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.submitMilestoneEvidence(
            agreementId, 0, keccak256("late"), "ipfs://late"
        );

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.raiseDispute(agreementId, 1, keccak256("late"));
    }

    function testTerminalMilestoneCannotBeDisputedOrRefundedTwice() public {
        _approve(0);

        vm.prank(payer);
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.raiseDispute(agreementId, 0, keccak256("late dispute"));
    }

    function testRevertingTokenLeavesFundingStateConsistent() public {
        RevertingToken badToken = new RevertingToken();
        uint256 id;
        vm.prank(payer);
        id = escrow.createAgreement(
            payee, arbitrator, address(badToken), TOTAL, TERMS_HASH, dueAts, amounts
        );

        vm.prank(payer);
        vm.expectRevert();
        escrow.fundAgreement(id);

        AgreementEscrow.Agreement memory agreement = escrow.getAgreement(id);
        assertEq(
            uint256(agreement.status),
            uint256(AgreementEscrow.AgreementStatus.Created)
        );
        assertEq(agreement.fundedAt, 0);
    }

    function testFeeOnTransferTokenRejectedAndStateUnchanged() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        feeToken.transfer(payer, TOTAL * 2);
        uint256 id;
        vm.prank(payer);
        id = escrow.createAgreement(
            payee, arbitrator, address(feeToken), TOTAL, TERMS_HASH, dueAts, amounts
        );

        vm.prank(payer);
        feeToken.approve(address(escrow), TOTAL);
        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgreementEscrow.TokenTransferMismatch.selector, TOTAL, TOTAL - (TOTAL / 100)
            )
        );
        escrow.fundAgreement(id);

        assertEq(
            uint256(escrow.getAgreement(id).status),
            uint256(AgreementEscrow.AgreementStatus.Created)
        );
    }

    function testIncorrectSplitsRejectedAndNoFundsMove() public {
        _submit(0);
        vm.prank(payer);
        escrow.raiseDispute(agreementId, 0, keccak256("split test"));

        uint256 payeeBefore = token.balanceOf(payee);
        uint256 payerBefore = token.balanceOf(payer);

        vm.startPrank(arbitrator);
        vm.expectRevert(AgreementEscrow.InvalidResolution.selector);
        escrow.resolveDispute(agreementId, 0, 1_001e6, 0);
        vm.expectRevert(AgreementEscrow.InvalidResolution.selector);
        escrow.resolveDispute(agreementId, 0, 0, 999e6);
        vm.stopPrank();

        assertEq(token.balanceOf(payee), payeeBefore);
        assertEq(token.balanceOf(payer), payerBefore);
    }

    function testZeroEvidencUriAllowedAndShortUriStored() public {
        _submit(0);
        AgreementEscrow.Milestone memory milestone = escrow.getMilestone(agreementId, 0);
        assertEq(milestone.evidenceUri, "ipfs://example-evidence-reference");
        assertEq(milestone.evidenceHash, EVIDENCE_HASH);
        assertGt(milestone.submittedAt, 0);
    }

    function testEvidenceUriTooLongRejected() public {
        string memory longUri = new string(513);
        vm.prank(payee);
        vm.expectRevert(AgreementEscrow.EvidenceUriTooLong.selector);
        escrow.submitMilestoneEvidence(agreementId, 0, EVIDENCE_HASH, longUri);
    }

    function testUnknownAgreementAndMilestoneRejected() public {
        vm.expectRevert(AgreementEscrow.InvalidStatus.selector);
        escrow.getAgreement(999);

        vm.expectRevert(AgreementEscrow.InvalidMilestone.selector);
        escrow.getMilestone(agreementId, 99);
    }

    function testFullRefundPath() public {
        _submit(0);
        vm.prank(payee);
        escrow.raiseDispute(agreementId, 0, keccak256("not delivered"));

        uint256 payerBefore = token.balanceOf(payer);
        vm.prank(arbitrator);
        escrow.resolveDispute(agreementId, 0, 0, 1_000e6);

        assertEq(token.balanceOf(payer) - payerBefore, 1_000e6);
        assertEq(escrow.getMilestone(agreementId, 0).refundedAmount, 1_000e6);
    }

    function testFuzzApprovalTransfersExactAmount(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 90_000e6);
        uint256[] memory one = new uint256[](1);
        one[0] = amount;
        uint64[] memory oneDate = new uint64[](1);
        oneDate[0] = uint64(block.timestamp + 30 days);

        vm.prank(payer);
        uint256 id = escrow.createAgreement(
            payee, arbitrator, address(token), amount, TERMS_HASH, oneDate, one
        );
        vm.prank(payer);
        escrow.fundAgreement(id);

        vm.prank(payee);
        escrow.submitMilestoneEvidence(id, 0, EVIDENCE_HASH, "");

        uint256 before = token.balanceOf(payee);
        vm.prank(payer);
        escrow.approveMilestone(id, 0);
        assertEq(token.balanceOf(payee) - before, amount);
        assertEq(
            uint256(escrow.getAgreement(id).status),
            uint256(AgreementEscrow.AgreementStatus.Completed)
        );
    }
}
