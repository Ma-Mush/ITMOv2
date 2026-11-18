import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Lizard Arena Custom MCP Server
 * Provides authoritative game calculations, combat balance simulation,
 * and entity specification verification.
 */
const server = new Server(
  {
    name: 'lizard-arena-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'simulate_combat',
        description:
          'Simulate combat damage, vampirism, and death between two lizards according to Lizard Arena core formulas.',
        inputSchema: {
          type: 'object',
          properties: {
            attackerScore: {
              type: 'number',
              description: 'Current score / HP of attacker lizard (must be positive number)',
            },
            victimScore: {
              type: 'number',
              description: 'Current score / HP of victim lizard (must be positive number)',
            },
            hitType: {
              type: 'string',
              enum: ['head_to_body', 'head_to_head'],
              description: 'Type of collision geometry (head_to_body or head_to_head)',
            },
          },
          required: ['attackerScore', 'victimScore', 'hitType'],
        },
      },
      {
        name: 'calculate_lizard_specs',
        description:
          'Calculate procedural physics specs (scale, head radius, segment count, speed, zoom) for a given score.',
        inputSchema: {
          type: 'object',
          properties: {
            score: {
              type: 'number',
              description: 'Score / HP of lizard (minimum 10)',
            },
          },
          required: ['score'],
        },
      },
    ],
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'simulate_combat') {
    const { attackerScore, victimScore, hitType } = (args || {}) as {
      attackerScore?: number;
      victimScore?: number;
      hitType?: string;
    };

    // Validation & Error Handling
    if (typeof attackerScore !== 'number' || Number.isNaN(attackerScore) || attackerScore <= 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[Validation Error]: attackerScore must be a finite positive number (> 0). Received: ${attackerScore}`,
          },
        ],
      };
    }

    if (typeof victimScore !== 'number' || Number.isNaN(victimScore) || victimScore <= 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[Validation Error]: victimScore must be a finite positive number (> 0). Received: ${victimScore}`,
          },
        ],
      };
    }

    if (hitType !== 'head_to_body' && hitType !== 'head_to_head') {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[Validation Error]: hitType must be either 'head_to_body' or 'head_to_head'. Received: '${hitType}'`,
          },
        ],
      };
    }

    // Formulas per AGENTS.md
    const scaleAttacker = Math.sqrt(Math.max(10, attackerScore) / 100);
    const scaleVictim = Math.sqrt(Math.max(10, victimScore) / 100);

    const damage = Math.round((25 + 10 * (scaleAttacker - 1)) * 10) / 10;
    const vampiricHeal = Math.round(damage * 0.4 * 10) / 10;

    let counterDamage = 0;
    let counterHeal = 0;
    if (hitType === 'head_to_head') {
      counterDamage = Math.round((25 + 10 * (scaleVictim - 1)) * 10) / 10;
      counterHeal = Math.round(counterDamage * 0.4 * 10) / 10;
    }

    const victimRemainingHp = Math.round((victimScore - damage) * 10) / 10;
    const isFatal = victimRemainingHp <= 0;
    const droppedBerries = isFatal ? Math.max(1, Math.floor(victimScore / 10)) : 0;

    const attackerFinalHp = Math.round((attackerScore + vampiricHeal - counterDamage) * 10) / 10;
    const victimFinalHp = Math.max(0, victimRemainingHp);

    const result = {
      status: 'success',
      simulation: {
        hitType,
        attacker: {
          initialHp: attackerScore,
          scale: Math.round(scaleAttacker * 1000) / 1000,
          damageDealt: damage,
          vampirismGained: vampiricHeal,
          counterDamageTaken: counterDamage,
          finalHp: attackerFinalHp,
        },
        victim: {
          initialHp: victimScore,
          scale: Math.round(scaleVictim * 1000) / 1000,
          damageTaken: damage,
          counterDamageDealt: counterDamage,
          counterVampirismGained: counterHeal,
          finalHp: victimFinalHp,
          isDead: isFatal,
          droppedBerriesOnDeath: droppedBerries,
        },
        balanceNotes: isFatal
          ? `Lizard died from lethal bite. Dropping ${droppedBerries} berries for arena mass distribution.`
          : `Lizard survived with ${victimFinalHp} HP remaining.`,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  if (name === 'calculate_lizard_specs') {
    const { score } = (args || {}) as { score?: number };

    if (typeof score !== 'number' || Number.isNaN(score) || score < 10) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[Validation Error]: score must be a finite number >= 10. Received: ${score}`,
          },
        ],
      };
    }

    const scale = Math.sqrt(score / 100);
    const headRadius = Math.round(18 * scale * 10) / 10;
    const segmentCount = Math.min(42, Math.floor(14 + (scale - 1) * 12));
    const segmentDistance = Math.round(14 * scale * 10) / 10;
    const totalBodyLength = Math.round(segmentCount * segmentDistance);
    const baseSpeed = Math.round((240 / Math.pow(scale, 0.2)) * 10) / 10;
    const sprintSpeed = Math.round(baseSpeed * 1.6 * 10) / 10;
    const cameraZoom = Math.round(Math.max(0.35, 1.0 / (0.8 + 0.2 * scale)) * 1000) / 1000;

    const specs = {
      status: 'success',
      specs: {
        score,
        scale: Math.round(scale * 1000) / 1000,
        headRadiusPx: headRadius,
        segmentCount,
        segmentDistancePx: segmentDistance,
        approximateBodyLengthPx: totalBodyLength,
        baseSpeedPxPerSec: baseSpeed,
        sprintSpeedPxPerSec: sprintSpeed,
        cameraZoomLevel: cameraZoom,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(specs, null, 2),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🦎 Lizard Arena MCP server running on stdio');
}

run().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});
