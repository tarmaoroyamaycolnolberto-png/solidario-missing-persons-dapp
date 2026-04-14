// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MissingPersons {
    enum Status {
        Missing,
        Found
    }

    struct MissingCase {
        uint256 id;
        address payable recipient;
        string metadataCID;
        Status status;
        uint256 totalDonated;
        address creator;
        bool active;
    }

    uint256 public nextCaseId;
    mapping(uint256 => MissingCase) private cases;

    bool private locked;

    event CaseCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        string metadataCID
    );

    event DonationReceived(
        uint256 indexed id,
        address indexed donor,
        uint256 amount
    );

    event StatusUpdated(
        uint256 indexed id,
        Status newStatus
    );

    error InvalidWallet();
    error EmptyCID();
    error CaseNotFound();
    error InactiveCase();
    error ZeroValue();
    error NotCreator();
    error TransferFailed();
    error ReentrancyBlocked();

    modifier nonReentrant() {
        if (locked) revert ReentrancyBlocked();
        locked = true;
        _;
        locked = false;
    }

    modifier caseExists(uint256 _id) {
        if (_id >= nextCaseId) revert CaseNotFound();
        _;
    }

    function createCase(address payable _recipient, string memory _metadataCID) external {
        if (_recipient == address(0)) revert InvalidWallet();
        if (bytes(_metadataCID).length == 0) revert EmptyCID();

        uint256 caseId = nextCaseId;

        cases[caseId] = MissingCase({
            id: caseId,
            recipient: _recipient,
            metadataCID: _metadataCID,
            status: Status.Missing,
            totalDonated: 0,
            creator: msg.sender,
            active: true
        });

        emit CaseCreated(caseId, msg.sender, _recipient, _metadataCID);
        nextCaseId++;
    }

    function donate(uint256 _id) external payable caseExists(_id) nonReentrant {
        MissingCase storage c = cases[_id];

        if (!c.active) revert InactiveCase();
        if (msg.value == 0) revert ZeroValue();

        c.totalDonated += msg.value;

        (bool sent, ) = c.recipient.call{value: msg.value}("");
        if (!sent) revert TransferFailed();

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    function updateStatus(uint256 _id, Status _status) external caseExists(_id) {
        MissingCase storage c = cases[_id];

        if (msg.sender != c.creator) revert NotCreator();

        c.status = _status;
        c.active = (_status == Status.Missing);

        emit StatusUpdated(_id, _status);
    }

    function getCase(uint256 _id) external view caseExists(_id) returns (MissingCase memory) {
        return cases[_id];
    }

    function caseExistsById(uint256 _id) external view returns (bool) {
        return _id < nextCaseId;
    }

    function getCasesCount() external view returns (uint256) {
        return nextCaseId;
    }
}