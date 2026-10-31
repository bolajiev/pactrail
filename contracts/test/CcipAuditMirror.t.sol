// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {CcipAuditReceiver, CcipAuditSender} from "../src/CcipAuditMirror.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";

contract MockCcipRouter is IRouterClient {
    uint256 public fee;
    bytes32 public nextMessageId = keccak256("message-1");
    bytes public lastData;
    address public lastReceiver;
    uint64 public lastSelector;
    address public lastFeeToken;
    uint256 public lastFeePaid;

    function setFee(uint256 fee_) external {
        fee = fee_;
    }

    function setNextMessageId(bytes32 id) external {
        nextMessageId = id;
    }

    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external view returns (uint256) {
        return fee;
    }

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external
        payable
        returns (bytes32)
    {
        lastSelector = destinationChainSelector;
        lastData = message.data;
        lastReceiver = abi.decode(message.receiver, (address));
        lastFeeToken = message.feeToken;
        lastFeePaid = fee;
        if (fee > 0) {
            require(
                IERC20Like(message.feeToken).transferFrom(msg.sender, address(this), fee),
                "fee transfer failed"
            );
        }
        return nextMessageId;
    }

    function deliver(address receiver, Client.Any2EVMMessage calldata message) external {
        CcipAuditReceiver(receiver).ccipReceive(message);
    }
}

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract CcipAuditMirrorTest is Test {
    uint64 internal constant SOURCE_SELECTOR = 16_015_286_601_757_825_753;
    bytes32 internal constant AGREEMENT_REF = keccak256("pactrail agreement 42");
    bytes32 internal constant TERMS_HASH = keccak256("approved terms");
    bytes32 internal constant REFERENCE_HASH = keccak256("evidence hash");
    bytes32 internal constant EVENT_KIND = keccak256("evidence.submitted");
    bytes32 internal constant MESSAGE_ID = keccak256("ccip message");

    MockCcipRouter internal router;
    MockStablecoin internal link;
    CcipAuditReceiver internal receiver;
    CcipAuditSender internal sender;
    address internal sourceSender = makeAddr("sourceSender");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        router = new MockCcipRouter();
        link = new MockStablecoin();
        receiver = new CcipAuditReceiver(address(router), SOURCE_SELECTOR, sourceSender);
        sender = new CcipAuditSender(
            address(router), address(link), 10_344_971_235_874_465_080, address(receiver)
        );
        link.mint(address(sender), 100e18);
    }

    function _message(bytes32 messageId, uint64 selector, address from, bytes memory data)
        internal
        pure
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: selector,
            sender: abi.encode(from),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _validMessage(bytes32 messageId)
        internal
        view
        returns (Client.Any2EVMMessage memory)
    {
        return _message(
            messageId,
            SOURCE_SELECTOR,
            sourceSender,
            abi.encode(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND)
        );
    }

    function testReceiverStoresAuditAnchorFromConfiguredRoute() public {
        vm.expectEmit(true, true, true, true, address(receiver));
        emit CcipAuditReceiver.AuditMirrored(
            MESSAGE_ID,
            AGREEMENT_REF,
            TERMS_HASH,
            REFERENCE_HASH,
            EVENT_KIND,
            SOURCE_SELECTOR,
            sourceSender,
            uint64(block.timestamp)
        );
        router.deliver(address(receiver), _validMessage(MESSAGE_ID));

        assertTrue(receiver.processedMessages(MESSAGE_ID));
        CcipAuditReceiver.MirrorRecord memory record = receiver.latestRecord(AGREEMENT_REF);
        assertEq(record.agreementRef, AGREEMENT_REF);
        assertEq(record.termsHash, TERMS_HASH);
        assertEq(record.referenceHash, REFERENCE_HASH);
        assertEq(record.eventKind, EVENT_KIND);
        assertEq(record.sourceChainSelector, SOURCE_SELECTOR);
        assertEq(record.messageId, MESSAGE_ID);
        assertEq(record.sourceSender, sourceSender);
        assertEq(record.receivedAt, uint64(block.timestamp));
    }

    function testReceiverRejectsUnauthorizedSourceChain() public {
        Client.Any2EVMMessage memory message =
            _message(MESSAGE_ID, 1, sourceSender, abi.encode(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND));
        vm.expectRevert(
            abi.encodeWithSelector(CcipAuditReceiver.UnauthorizedSourceChain.selector, 1)
        );
        router.deliver(address(receiver), message);
    }

    function testReceiverRejectsUnauthorizedSender() public {
        Client.Any2EVMMessage memory message =
            _message(MESSAGE_ID, SOURCE_SELECTOR, outsider, abi.encode(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND));
        vm.expectRevert(
            abi.encodeWithSelector(CcipAuditReceiver.UnauthorizedSender.selector, outsider)
        );
        router.deliver(address(receiver), message);
    }

    function testReceiverRejectsReplay() public {
        router.deliver(address(receiver), _validMessage(MESSAGE_ID));
        vm.expectRevert(
            abi.encodeWithSelector(
                CcipAuditReceiver.MessageAlreadyProcessed.selector, MESSAGE_ID
            )
        );
        router.deliver(address(receiver), _validMessage(MESSAGE_ID));
    }

    function testReceiverRejectsMalformedPayload() public {
        Client.Any2EVMMessage memory message =
            _message(MESSAGE_ID, SOURCE_SELECTOR, sourceSender, abi.encode(AGREEMENT_REF));
        vm.expectRevert(CcipAuditReceiver.InvalidPayload.selector);
        router.deliver(address(receiver), message);
    }

    function testReceiverOnlyAcceptsRouter() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                CCIPReceiver.InvalidRouter.selector, address(this)
            )
        );
        receiver.ccipReceive(_validMessage(MESSAGE_ID));
    }

    function testReceiverConstructorRejectsZeroSender() public {
        vm.expectRevert(CcipAuditReceiver.InvalidSourceSender.selector);
        new CcipAuditReceiver(address(router), SOURCE_SELECTOR, address(0));
    }

    function testSenderBuildsAndPaysCcipMessage() public {
        router.setFee(1e18);
        router.setNextMessageId(MESSAGE_ID);
        uint64 destinationSelector = 10_344_971_235_874_465_080;

        vm.expectEmit(true, true, true, true, address(sender));
        emit CcipAuditSender.AuditAnchorSent(
            MESSAGE_ID,
            destinationSelector,
            address(receiver),
            AGREEMENT_REF,
            TERMS_HASH,
            REFERENCE_HASH,
            EVENT_KIND,
            1e18
        );
        bytes32 messageId =
            sender.sendAuditAnchor(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND);

        assertEq(messageId, MESSAGE_ID);
        assertEq(router.lastSelector(), destinationSelector);
        assertEq(router.lastReceiver(), address(receiver));
        assertEq(router.lastFeeToken(), address(link));
        assertEq(router.lastFeePaid(), 1e18);
        assertEq(link.balanceOf(address(router)), 1e18);
        assertEq(
            router.lastData(),
            abi.encode(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND)
        );
    }

    function testSenderRejectsInsufficientLink() public {
        router.setFee(1_000e18);
        vm.expectRevert(
            abi.encodeWithSelector(
                CcipAuditSender.InsufficientLink.selector, 1_000e18, 100e18
            )
        );
        sender.sendAuditAnchor(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND);
    }

    function testSenderOnlyOwnerCanSend() public {
        vm.prank(outsider);
        vm.expectRevert();
        sender.sendAuditAnchor(AGREEMENT_REF, TERMS_HASH, REFERENCE_HASH, EVENT_KIND);
    }

    function testSenderRejectsZeroDependencies() public {
        vm.expectRevert(CcipAuditSender.InvalidRouter.selector);
        new CcipAuditSender(address(0), address(link), 1, address(receiver));
        vm.expectRevert(CcipAuditSender.InvalidLinkToken.selector);
        new CcipAuditSender(address(router), address(0), 1, address(receiver));
        vm.expectRevert(CcipAuditSender.InvalidReceiver.selector);
        new CcipAuditSender(address(router), address(link), 1, address(0));
    }
}
