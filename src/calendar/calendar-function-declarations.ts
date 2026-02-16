import { Type, type FunctionDeclaration } from '@google/genai';

export const CALENDAR_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'list_calendar_events',
    description:
      'Lista eventos do Google Calendar do usuario. Retorna compromissos futuros ou em um periodo especifico.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description:
            'Email da conta Google para buscar eventos. Se o usuario tem multiplas contas, pergunte qual usar.',
        },
        time_min: {
          type: Type.STRING,
          description:
            'Data/hora minima em ISO 8601 (ex: 2025-01-15T00:00:00-03:00). Padrao: agora.',
        },
        time_max: {
          type: Type.STRING,
          description:
            'Data/hora maxima em ISO 8601 (ex: 2025-01-16T23:59:59-03:00).',
        },
        max_results: {
          type: Type.INTEGER,
          description: 'Numero maximo de eventos para retornar. Padrao: 10.',
        },
        search: {
          type: Type.STRING,
          description: 'Termo de busca para filtrar eventos por titulo.',
        },
      },
    },
  },
  {
    name: 'create_calendar_event',
    description:
      'Cria um novo evento no Google Calendar do usuario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description: 'Email da conta Google onde criar o evento.',
        },
        summary: {
          type: Type.STRING,
          description: 'Titulo do evento (ex: "Dentista", "Reuniao com time").',
        },
        start_datetime: {
          type: Type.STRING,
          description:
            'Data/hora de inicio em ISO 8601 (ex: 2025-01-15T14:00:00-03:00).',
        },
        end_datetime: {
          type: Type.STRING,
          description:
            'Data/hora de fim em ISO 8601. Se nao informado, assume 1 hora apos o inicio.',
        },
        description: {
          type: Type.STRING,
          description: 'Descricao ou notas do evento.',
        },
        location: {
          type: Type.STRING,
          description: 'Local do evento.',
        },
      },
      required: ['summary', 'start_datetime'],
    },
  },
  {
    name: 'update_calendar_event',
    description:
      'Atualiza um evento existente no Google Calendar. Use apos listar eventos para obter o event_id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description: 'Email da conta Google do evento.',
        },
        event_id: {
          type: Type.STRING,
          description: 'ID do evento a atualizar (obtido ao listar eventos).',
        },
        summary: {
          type: Type.STRING,
          description: 'Novo titulo do evento.',
        },
        start_datetime: {
          type: Type.STRING,
          description: 'Nova data/hora de inicio em ISO 8601.',
        },
        end_datetime: {
          type: Type.STRING,
          description: 'Nova data/hora de fim em ISO 8601.',
        },
        description: {
          type: Type.STRING,
          description: 'Nova descricao.',
        },
        location: {
          type: Type.STRING,
          description: 'Novo local.',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'delete_calendar_event',
    description:
      'Remove um evento do Google Calendar. Use apos listar eventos para obter o event_id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description: 'Email da conta Google do evento.',
        },
        event_id: {
          type: Type.STRING,
          description: 'ID do evento a remover.',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'check_availability',
    description:
      'Verifica se o usuario esta livre ou ocupado em um periodo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description: 'Email da conta Google para verificar.',
        },
        time_min: {
          type: Type.STRING,
          description: 'Inicio do periodo em ISO 8601.',
        },
        time_max: {
          type: Type.STRING,
          description: 'Fim do periodo em ISO 8601.',
        },
      },
      required: ['time_min', 'time_max'],
    },
  },
  {
    name: 'list_calendars',
    description:
      'Lista todas as agendas do Google Calendar do usuario (ex: pessoal, trabalho, feriados).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description: 'Email da conta Google para listar agendas.',
        },
      },
    },
  },
  {
    name: 'disconnect_google_calendar',
    description:
      'Desconecta uma conta do Google Calendar. Remove acesso a agenda.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_email: {
          type: Type.STRING,
          description:
            'Email da conta Google a desconectar. Se nao informado, desconecta todas.',
        },
      },
    },
  },
];

export const CONNECT_FUNCTION: FunctionDeclaration = {
  name: 'connect_google_calendar',
  description:
    'Gera um link para o usuario conectar sua conta do Google Calendar. O usuario precisa abrir o link no navegador para autorizar.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};
