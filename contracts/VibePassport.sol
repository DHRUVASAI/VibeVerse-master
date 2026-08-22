// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SoulboundVibePassport
 * @notice Monad Blitz Hackathon Smart Contract
 * @dev Stores user-owned Soulbound Vibe Passports, deterministic 8-D Vibe Signatures, and Vibe Fusions on Monad Testnet.
 * Tokens are non-transferable (Soulbound) to ensure authentic decentralized identity.
 */
contract VibePassport {
    // --- Data Structures ---

    struct Passport {
        uint256 id;
        address owner;
        string archetype;          // e.g. "Night Explorer", "Cosmic Dreamer", "Hyper Kinetic"
        bytes32 vibeSignature;      // Canonical 8-D keccak256 hash of off-chain non-sensitive taste profile
        uint8 energy;              // 0-100%
        uint8 exploration;         // 0-100%
        uint8 nostalgia;           // 0-100%
        string metadataURI;        // Decentralized reference / IPFS or canonical URL
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct Fusion {
        uint256 id;
        address userA;
        address userB;
        bytes32 fusionSignature;   // Cryptographic combined signature
        uint8 compatibilityScore;  // 0-100%
        string sharedVibe;         // e.g. "MIDNIGHT ADVENTURE"
        string metadataURI;
        uint256 timestamp;
    }

    // --- State Variables ---

    string public constant NAME = "Soulbound VibeVerse Passport";
    string public constant SYMBOL = "SOULVIBE";
    bool public constant isSoulbound = true;

    uint256 private _passportIdCounter;
    uint256 private _fusionIdCounter;

    // Mapping from passport ID to Passport
    mapping(uint256 => Passport) public passports;

    // Mapping from owner address to their primary Passport ID
    mapping(address => uint256) public ownerToPassportId;

    // Mapping from fusion ID to Fusion
    mapping(uint256 => Fusion) public fusions;

    // Mapping from user address to array of their Fusion IDs
    mapping(address => uint256[]) public userFusions;

    // Total passports and fusions count
    uint256 public totalPassports;
    uint256 public totalFusions;

    // --- Events ---

    event PassportCreated(
        uint256 indexed passportId,
        address indexed owner,
        string archetype,
        bytes32 vibeSignature,
        uint8 energy,
        uint8 exploration,
        uint8 nostalgia,
        uint256 timestamp
    );

    event PassportUpdated(
        uint256 indexed passportId,
        address indexed owner,
        string archetype,
        bytes32 vibeSignature,
        uint8 energy,
        uint8 exploration,
        uint8 nostalgia,
        uint256 timestamp
    );

    event VibeFusionCreated(
        uint256 indexed fusionId,
        address indexed userA,
        address indexed userB,
        uint8 compatibilityScore,
        string sharedVibe,
        bytes32 fusionSignature,
        uint256 timestamp
    );

    // --- Soulbound NFT Non-Transferability Guard ---

    function transferFrom(address, address, uint256) external pure {
        revert("Soulbound: Vibe Passports are bound to the minter and non-transferable");
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert("Soulbound: Vibe Passports are bound to the minter and non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert("Soulbound: Vibe Passports are bound to the minter and non-transferable");
    }

    // --- Core Functions ---

    /**
     * @notice Create or mint a new Soulbound Vibe Passport on Monad
     */
    function createPassport(
        string calldata archetype,
        bytes32 vibeSignature,
        uint8 energy,
        uint8 exploration,
        uint8 nostalgia,
        string calldata metadataURI
    ) external returns (uint256) {
        require(vibeSignature != bytes32(0), "Invalid vibe signature");
        require(bytes(archetype).length > 0, "Archetype cannot be empty");

        uint256 existingId = ownerToPassportId[msg.sender];
        if (existingId != 0) {
            // Update existing passport seamlessly
            passports[existingId].archetype = archetype;
            passports[existingId].vibeSignature = vibeSignature;
            passports[existingId].energy = energy;
            passports[existingId].exploration = exploration;
            passports[existingId].nostalgia = nostalgia;
            passports[existingId].metadataURI = metadataURI;
            passports[existingId].updatedAt = block.timestamp;

            emit PassportUpdated(existingId, msg.sender, archetype, vibeSignature, energy, exploration, nostalgia, block.timestamp);
            return existingId;
        }

        _passportIdCounter++;
        uint256 newPassportId = _passportIdCounter;

        passports[newPassportId] = Passport({
            id: newPassportId,
            owner: msg.sender,
            archetype: archetype,
            vibeSignature: vibeSignature,
            energy: energy,
            exploration: exploration,
            nostalgia: nostalgia,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        ownerToPassportId[msg.sender] = newPassportId;
        totalPassports++;

        emit PassportCreated(
            newPassportId,
            msg.sender,
            archetype,
            vibeSignature,
            energy,
            exploration,
            nostalgia,
            block.timestamp
        );

        return newPassportId;
    }

    /**
     * @notice Minimal overload: create passport with 8-D vibe hash
     */
    function createPassport(bytes32 vibeHash) external returns (uint256) {
        return this.createPassport("Night Explorer", vibeHash, 82, 91, 63, "");
    }

    /**
     * @notice Create an on-chain Vibe Fusion between two user passports
     */
    function createFusion(
        address partner,
        bytes32 fusionSignature,
        uint8 compatibilityScore,
        string calldata sharedVibe,
        string calldata metadataURI
    ) external returns (uint256) {
        require(partner != address(0) && partner != msg.sender, "Invalid partner address");
        require(fusionSignature != bytes32(0), "Invalid fusion signature");
        require(compatibilityScore <= 100, "Score exceeds 100%");

        _fusionIdCounter++;
        uint256 newFusionId = _fusionIdCounter;

        fusions[newFusionId] = Fusion({
            id: newFusionId,
            userA: msg.sender,
            userB: partner,
            fusionSignature: fusionSignature,
            compatibilityScore: compatibilityScore,
            sharedVibe: sharedVibe,
            metadataURI: metadataURI,
            timestamp: block.timestamp
        });

        userFusions[msg.sender].push(newFusionId);
        userFusions[partner].push(newFusionId);
        totalFusions++;

        emit VibeFusionCreated(
            newFusionId,
            msg.sender,
            partner,
            compatibilityScore,
            sharedVibe,
            fusionSignature,
            block.timestamp
        );

        return newFusionId;
    }

    // --- View / Verification Functions ---

    function getPassport(uint256 passportId) external view returns (Passport memory) {
        require(passports[passportId].id != 0, "Passport not found");
        return passports[passportId];
    }

    function getPassportByOwner(address owner) external view returns (Passport memory) {
        uint256 id = ownerToPassportId[owner];
        require(id != 0, "No passport found for owner");
        return passports[id];
    }

    function getUserFusions(address user) external view returns (uint256[] memory) {
        return userFusions[user];
    }

    function getFusion(uint256 fusionId) external view returns (Fusion memory) {
        require(fusions[fusionId].id != 0, "Fusion not found");
        return fusions[fusionId];
    }

    function verifyVibeSignature(uint256 passportId, bytes32 expectedSignature) external view returns (bool) {
        if (passports[passportId].id == 0) return false;
        return passports[passportId].vibeSignature == expectedSignature;
    }
}
