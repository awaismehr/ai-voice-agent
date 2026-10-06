import { DataSource } from 'typeorm';
import { ConversationService } from './conversation.service.js';
import { Message } from './message.entity.js';

describe('ConversationService', () => {
  let dataSource: DataSource;
  let service: ConversationService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Message],
      synchronize: true,
    });
    await dataSource.initialize();
    service = new ConversationService(dataSource.getRepository(Message));
  });

  afterEach(() => dataSource.destroy());

  it('returns history oldest first, in the order messages were appended', async () => {
    await service.append('a', 'user', 'first');
    await service.append('a', 'assistant', 'second');
    await service.append('a', 'user', 'third');

    const history = await service.getHistory('a');

    expect(history.map((m) => [m.role, m.content])).toEqual([
      ['user', 'first'],
      ['assistant', 'second'],
      ['user', 'third'],
    ]);
  });

  it('returns an empty history for an unknown conversation', async () => {
    expect(await service.getHistory('missing')).toEqual([]);
  });

  it('reset clears only the target conversation', async () => {
    await service.append('a', 'user', 'keep me not');
    await service.append('b', 'user', 'keep me');

    await service.reset('a');

    expect(await service.getHistory('a')).toEqual([]);
    expect((await service.getHistory('b')).map((m) => m.content)).toEqual([
      'keep me',
    ]);
  });
});
