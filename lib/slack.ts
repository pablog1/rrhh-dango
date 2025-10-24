import { UserWithoutHours } from './types';

interface SlackMessage {
  text?: string;
  blocks?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    elements?: Array<{
      type: string;
      text: string;
      emoji?: boolean;
    }>;
    fields?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

/**
 * Send notification to Slack webhook
 */
export async function sendSlackNotification(
  users: UserWithoutHours[],
  dateRange: { from: string; to: string },
  isManual: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Slack] Webhook URL not configured, skipping notification');
    return { success: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  try {
    const trigger = isManual ? '🔵 Verificación Manual' : '🤖 Verificación Automática';
    const emoji = users.length > 0 ? ':warning:' : ':white_check_mark:';

    let message: SlackMessage;

    if (users.length === 0) {
      // Todos los usuarios tienen horas registradas
      message = {
        text: `${emoji} Todos los empleados registraron horas`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} RRHH: Todos los empleados OK`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Tipo:*\n${trigger}`,
              },
              {
                type: 'mrkdwn',
                text: `*Período:*\n${dateRange.from} → ${dateRange.to}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `✅ Todos los empleados registraron horas en los últimos 2 días laborables`,
              },
            ],
          },
        ],
      };
    } else {
      // Hay usuarios sin horas
      const usersList = users
        .slice(0, 10) // Limitar a 10 usuarios para no saturar
        .map((user) => {
          const days = user.daysWithoutEntries || '?';
          const lastEntry = user.lastEntry || 'Sin registros';
          const hours = user.totalHoursLast30Days || '0 h 0 min';
          return `• *${user.name}*\n  └ ${days} días sin registros | Último: ${lastEntry} | 30d: ${hours}`;
        })
        .join('\n\n');

      const moreUsers = users.length > 10 ? `\n\n_...y ${users.length - 10} usuarios más_` : '';

      message = {
        text: `:warning: ${users.length} empleados sin horas registradas`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `:warning: RRHH Alert: ${users.length} empleados sin horas`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Tipo:*\n${trigger}`,
              },
              {
                type: 'mrkdwn',
                text: `*Período:*\n${dateRange.from} → ${dateRange.to}`,
              },
              {
                type: 'mrkdwn',
                text: `*Usuarios afectados:*\n${users.length}`,
              },
              {
                type: 'mrkdwn',
                text: `*Fecha:*\n${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Detalle de usuarios:*\n\n${usersList}${moreUsers}`,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '💡 *Acción requerida:* Verificar con cada empleado el motivo de la falta de registro',
              },
            ],
          },
        ],
      };
    }

    console.log('[Slack] Sending notification to Slack...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Slack] Error sending notification:', response.status, errorText);
      return {
        success: false,
        error: `Slack API returned ${response.status}: ${errorText}`,
      };
    }

    console.log('[Slack] ✓ Notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[Slack] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send simple text notification to Slack
 */
export async function sendSlackMessage(message: string): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Slack] Webhook URL not configured, skipping message');
    return { success: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Slack API returned ${response.status}: ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
