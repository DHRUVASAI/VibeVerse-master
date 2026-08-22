import { ethers } from 'ethers';
import contractArtifact from './contracts/VibePassport.json';
import contractConfig from './contracts/contractConfig.json';

// --- Monad Network Parameters ---
export const MONAD_NETWORK = {
    chainId: '0x279f', // 10143 in hex
    chainIdDecimal: 10143,
    chainName: 'Monad Testnet',
    nativeCurrency: {
        name: 'Monad',
        symbol: 'MON',
        decimals: 18
    },
    rpcUrls: ['https://testnet-rpc.monad.xyz', 'https://testnet-rpc2.monad.xyz'],
    blockExplorerUrls: ['https://testnet.monadexplorer.com']
};

export const CONTRACT_ADDRESS = contractConfig.contractAddress || '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318';
export const CONTRACT_ABI = contractArtifact.abi;

/**
 * 8-Dimensional Vibe DNA Dimensions
 */
export const VIBE_DNA_DIMENSIONS = [
    'Energy',
    'Exploration',
    'Nostalgia',
    'Complexity',
    'Mainstream',
    'Intensity',
    'Diversity',
    'Discovery'
];

/**
 * Archetype definitions based on 8-D Vibe DNA clusters
 */
export const VIBE_ARCHETYPES = {
    NIGHT_EXPLORER: {
        id: 'NIGHT_EXPLORER',
        name: 'Night Explorer',
        emoji: '🌌',
        tagline: 'Deep, mysterious, and fascinated by speculative, complex worlds.',
        genres: ['Sci-Fi', 'Electronic', 'Indie', 'Mystery'],
        dna: { Energy: 82, Exploration: 91, Nostalgia: 63, Complexity: 88, Mainstream: 34, Intensity: 76, Diversity: 84, Discovery: 93 },
        color: '#6366f1'
    },
    COSMIC_DREAMER: {
        id: 'COSMIC_DREAMER',
        name: 'Cosmic Dreamer',
        emoji: '🌙',
        tagline: 'Emotional, atmospheric, and drawn to soul-stirring ambient cinema and sounds.',
        genres: ['Romance', 'Ambient', 'Chill', 'Drama'],
        dna: { Energy: 45, Exploration: 78, Nostalgia: 86, Complexity: 72, Mainstream: 42, Intensity: 52, Diversity: 68, Discovery: 80 },
        color: '#a855f7'
    },
    HYPER_KINETIC: {
        id: 'HYPER_KINETIC',
        name: 'Hyper Kinetic',
        emoji: '⚡',
        tagline: 'High energy, adrenaline-fueled, and constantly seeking fast-paced blockbusters.',
        genres: ['Action', 'Thriller', 'Electronic', 'Rock'],
        dna: { Energy: 95, Exploration: 68, Nostalgia: 32, Complexity: 58, Mainstream: 78, Intensity: 94, Diversity: 62, Discovery: 74 },
        color: '#ef4444'
    },
    SOLAR_OPTIMIST: {
        id: 'SOLAR_OPTIMIST',
        name: 'Solar Optimist',
        emoji: '☀️',
        tagline: 'Uplifting, feel-good, and radiating warmth through comedies and upbeat melodies.',
        genres: ['Comedy', 'Pop', 'Family', 'Animation'],
        dna: { Energy: 84, Exploration: 62, Nostalgia: 64, Complexity: 45, Mainstream: 82, Intensity: 60, Diversity: 70, Discovery: 68 },
        color: '#f59e0b'
    },
    ASTRAL_NOMAD: {
        id: 'ASTRAL_NOMAD',
        name: 'Astral Nomad',
        emoji: '🧭',
        tagline: 'Global cinema connoisseur, unearthing stories across cultures and languages.',
        genres: ['Adventure', 'World', 'Documentary', 'Fantasy'],
        dna: { Energy: 76, Exploration: 98, Nostalgia: 52, Complexity: 86, Mainstream: 28, Intensity: 70, Diversity: 96, Discovery: 95 },
        color: '#10b981'
    },
    VINTAGE_CINEPHILE: {
        id: 'VINTAGE_CINEPHILE',
        name: 'Vintage Cinephile',
        emoji: '🎞️',
        tagline: 'Grounded in timeless classics, auteur storytelling, and rich orchestral scores.',
        genres: ['Classic', 'Jazz', 'Noir', 'Historical'],
        dna: { Energy: 40, Exploration: 72, Nostalgia: 96, Complexity: 89, Mainstream: 30, Intensity: 58, Diversity: 74, Discovery: 65 },
        color: '#8b5cf6'
    }
};

/**
 * Calculates user's 8-Dimensional Vibe DNA vector from interaction logs
 */
export function calculateVibeProfile(moodMemories = [], quizAnswers = {}, currentMood = null) {
    let dna = {
        Energy: 65,
        Exploration: 75,
        Nostalgia: 50,
        Complexity: 70,
        Mainstream: 45,
        Intensity: 60,
        Diversity: 72,
        Discovery: 80
    };

    const moodCounts = {};
    if (currentMood) moodCounts[currentMood] = (moodCounts[currentMood] || 0) + 2;

    moodMemories.forEach(m => {
        const mood = m.mood;
        if (mood) moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });

    // Quiz inputs influence DNA
    if (quizAnswers.energy === 'high') { dna.Energy += 20; dna.Intensity += 18; }
    if (quizAnswers.energy === 'low') { dna.Energy -= 20; dna.Intensity -= 12; }
    if (quizAnswers.story === 'complex') { dna.Complexity += 22; dna.Exploration += 15; dna.Discovery += 12; }
    if (quizAnswers.story === 'reality') { dna.Nostalgia += 10; dna.Mainstream += 8; }
    if (quizAnswers.desire === 'nostalgic') { dna.Nostalgia += 30; dna.Mainstream -= 10; }
    if (quizAnswers.desire === 'laugh') { dna.Energy += 12; dna.Intensity -= 10; }

    // Mood interaction influence
    if (moodCounts['Action'] || moodCounts['Thriller']) { dna.Energy += 14; dna.Intensity += 22; }
    if (moodCounts['Chill'] || moodCounts['Sad']) { dna.Energy -= 16; dna.Complexity += 10; }
    if (moodCounts['Mystery'] || moodCounts['Surprise Me']) { dna.Exploration += 18; dna.Discovery += 16; dna.Complexity += 12; }
    if (moodCounts['Romantic'] || moodCounts['Sad']) { dna.Nostalgia += 18; }

    // Clamp all dimensions 15 - 99
    Object.keys(dna).forEach(k => {
        dna[k] = Math.min(99, Math.max(15, Math.round(dna[k])));
    });

    // Determine Closest Archetype using Euclidean distance
    let closestArchetype = VIBE_ARCHETYPES.NIGHT_EXPLORER;
    let minDistance = Infinity;

    Object.values(VIBE_ARCHETYPES).forEach(arch => {
        let dist = 0;
        VIBE_DNA_DIMENSIONS.forEach(dim => {
            const diff = (dna[dim] || 50) - (arch.dna[dim] || 50);
            dist += diff * diff;
        });
        if (dist < minDistance) {
            minDistance = dist;
            closestArchetype = arch;
        }
    });

    const sessionsCount = Math.max(1, moodMemories.length + (currentMood ? 1 : 0));
    const vibesCreated = Math.max(1, Math.floor(sessionsCount / 2));
    const fusionsCount = parseInt(localStorage.getItem('vibeverse_fusions_count') || '0', 10);

    return {
        archetype: closestArchetype,
        vibeDNA: dna,
        energy: dna.Energy,
        exploration: dna.Exploration,
        nostalgia: dna.Nostalgia,
        complexity: dna.Complexity,
        mainstream: dna.Mainstream,
        intensity: dna.Intensity,
        diversity: dna.Diversity,
        discovery: dna.Discovery,
        sessionsCount,
        vibesCreated,
        fusionsCount,
        timestamp: Date.now()
    };
}

/**
 * Computes Cosine Similarity between two 8-D Vibe DNA vectors:
 * cosine_similarity(A, B) = (A · B) / (||A|| * ||B||)
 */
export function calculateCosineSimilarity(dnaA, dnaB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    VIBE_DNA_DIMENSIONS.forEach(dim => {
        const valA = dnaA[dim] || 50;
        const valB = dnaB[dim] || 50;
        dotProduct += valA * valB;
        normA += valA * valA;
        normB += valB * valB;
    });

    if (normA === 0 || normB === 0) return 0.85;
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.min(0.99, Math.max(0.60, similarity));
}

/**
 * Generates Vibe Twins with explainable matching metrics
 */
export function getVibeTwins(userProfile) {
    const userDNA = userProfile.vibeDNA;

    const sampleTwins = [
        {
            id: 'twin_1',
            name: 'Alex Vance',
            handle: '@alex_v',
            address: '0x38B57d81a986B6D197c36a61E2eE1B4F435F36a2',
            avatar: '🎧',
            archetype: VIBE_ARCHETYPES.NIGHT_EXPLORER,
            dna: { Energy: 78, Exploration: 96, Nostalgia: 58, Complexity: 91, Mainstream: 28, Intensity: 88, Diversity: 90, Discovery: 94 },
            favoriteGenres: ['Sci-Fi', 'Synthwave', 'Psychological Thriller']
        },
        {
            id: 'twin_2',
            name: 'Elena Rostova',
            handle: '@elena_cine',
            address: '0x89D2F818a5621d965F292B4527781C2fB918B21e',
            avatar: '🎞️',
            archetype: VIBE_ARCHETYPES.ASTRAL_NOMAD,
            dna: { Energy: 72, Exploration: 94, Nostalgia: 60, Complexity: 85, Mainstream: 32, Intensity: 74, Diversity: 98, Discovery: 92 },
            favoriteGenres: ['World Cinema', 'Ambient Indie', 'Auteur Noir']
        },
        {
            id: 'twin_3',
            name: 'Marcus Chen',
            handle: '@marcus_k',
            address: '0x71C6370244569339304990928232938492023972',
            avatar: '⚡',
            archetype: VIBE_ARCHETYPES.HYPER_KINETIC,
            dna: { Energy: 92, Exploration: 70, Nostalgia: 40, Complexity: 65, Mainstream: 68, Intensity: 95, Diversity: 65, Discovery: 78 },
            favoriteGenres: ['Cyberpunk Action', 'Electronic Rock', 'High-Stakes Heist']
        }
    ];

    return sampleTwins.map(twin => {
        const similarity = calculateCosineSimilarity(userDNA, twin.dna);
        const matchPercent = Math.round(similarity * 100);

        // Find top 3 aligned dimensions (smallest differences & both high)
        const dimDifferences = VIBE_DNA_DIMENSIONS.map(dim => {
            const diff = Math.abs(userDNA[dim] - twin.dna[dim]);
            const avgVal = (userDNA[dim] + twin.dna[dim]) / 2;
            return { dim, diff, avgVal, userVal: userDNA[dim], twinVal: twin.dna[dim] };
        });

        dimDifferences.sort((a, b) => a.diff - b.diff);
        const topAligned = dimDifferences.slice(0, 3);

        // Find 1 complementary (contrasting) dimension
        const contrasting = dimDifferences[dimDifferences.length - 1];

        const whyWeMatch = {
            topTraits: topAligned.map(t => `${t.dim} (${Math.round(100 - t.diff)}%)`),
            rationale: `Shared ${topAligned.map(t => t.dim).join(', ')}. You favor atmospheric depth while ${twin.name.split(' ')[0]} brings high-octane energy, creating a perfectly balanced Vibe Fusion.`
        };

        return {
            ...twin,
            matchPercent,
            similarity,
            topAligned,
            contrasting,
            whyWeMatch
        };
    }).sort((a, b) => b.matchPercent - a.matchPercent);
}

/**
 * Generates deterministic canonical JSON and computes keccak256 Vibe Signature
 */
export function generateVibeSignature(profile, walletAddress) {
    if (!profile) return { signature: '0x0', canonicalJSON: '{}' };

    // Canonical 8-D payload for Soulbound Passport
    const canonicalPayload = {
        archetype: profile.archetype.name,
        owner: (walletAddress || '').toLowerCase(),
        standard: 'SOULBOUND_VIBE_PASSPORT_V1',
        vibeDNA: profile.vibeDNA || {
            Complexity: profile.complexity || 70,
            Discovery: profile.discovery || 80,
            Diversity: profile.diversity || 72,
            Energy: profile.energy || 65,
            Exploration: profile.exploration || 75,
            Intensity: profile.intensity || 60,
            Mainstream: profile.mainstream || 45,
            Nostalgia: profile.nostalgia || 50
        }
    };

    // Sort keys alphabetically for strict determinism
    const sortedKeys = Object.keys(canonicalPayload).sort();
    const canonicalObj = {};
    sortedKeys.forEach(k => { canonicalObj[k] = canonicalPayload[k]; });
    const canonicalJSON = JSON.stringify(canonicalObj);

    // Compute keccak256 hash using ethers
    const signature = ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON));

    return {
        signature,
        canonicalJSON,
        canonicalPayload
    };
}

/**
 * Calculates Vibe Fusion compatibility and creates curated shared experience
 */
export function calculateVibeFusion(profileA, partnerAddress, partnerProfile = null) {
    const pB = partnerProfile || {
        name: 'Alex Vance',
        archetype: VIBE_ARCHETYPES.NIGHT_EXPLORER,
        vibeDNA: { Energy: 78, Exploration: 96, Nostalgia: 58, Complexity: 91, Mainstream: 28, Intensity: 88, Diversity: 90, Discovery: 94 }
    };

    const sim = calculateCosineSimilarity(profileA.vibeDNA, pB.vibeDNA);
    const compatibilityScore = Math.round(sim * 100);

    const sharedVibes = [
        'MIDNIGHT ADVENTURE',
        'MIND-BENDING MIDNIGHT',
        'CELESTIAL HARMONY',
        'SYNTHWAVE ODYSSEY',
        'ELECTRIC NOSTALGIA',
        'COSMIC EXPLORATION'
    ];

    const idx = Math.abs((profileA.energy + (pB.vibeDNA.Exploration || 80)) % sharedVibes.length);
    const sharedVibe = sharedVibes[idx];

    // Fusion signature
    const fusionPayload = JSON.stringify({
        userA: profileA.owner || '0xUserA',
        userB: partnerAddress,
        compatibilityScore,
        sharedVibe,
        timestamp: Date.now()
    });
    const fusionSignature = ethers.keccak256(ethers.toUtf8Bytes(fusionPayload));

    return {
        compatibilityScore,
        sharedVibe,
        fusionSignature,
        userAProfile: profileA,
        userBProfile: pB
    };
}

/**
 * Switch or add Monad Testnet to wallet
 */
export async function switchToMonadTestnet() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask or Web3 provider not found');
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_NETWORK.chainId }]
        });
        return true;
    } catch (switchError) {
        if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: MONAD_NETWORK.chainId,
                    chainName: MONAD_NETWORK.chainName,
                    nativeCurrency: MONAD_NETWORK.nativeCurrency,
                    rpcUrls: MONAD_NETWORK.rpcUrls,
                    blockExplorerUrls: MONAD_NETWORK.blockExplorerUrls
                }]
            });
            return true;
        }
        throw switchError;
    }
}
