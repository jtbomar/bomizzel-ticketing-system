import { TeamService } from '../src/services/TeamService';
import { Team } from '../src/models/Team';

describe('TeamService.deleteTeam', () => {
  const TEAM = { id: 'team-1', name: 'Archived - Support Team' };

  // Team.db('tickets').where(...).count(...).first()
  const stubTicketCount = (count: number) => {
    const chain: any = {
      where: jest.fn(() => chain),
      count: jest.fn(() => chain),
      first: jest.fn(async () => ({ count: String(count) })),
    };
    (Team as any).db = jest.fn(() => chain);
    return chain;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Team, 'findById').mockResolvedValue(TEAM as any);
    jest.spyOn(Team, 'delete').mockResolvedValue(true as any);
  });

  it('deletes a team that has no tickets', async () => {
    stubTicketCount(0);

    await TeamService.deleteTeam('team-1', 'admin-1');

    expect(Team.delete).toHaveBeenCalledWith('team-1');
  });

  it('refuses a team that still has tickets, and says how many', async () => {
    // tickets.team_id is RESTRICT, so the database would refuse anyway - but as
    // a raw constraint violation surfacing as a 500. This turns it into
    // something the caller can act on.
    stubTicketCount(7);

    await expect(TeamService.deleteTeam('team-1', 'admin-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TEAM_HAS_TICKETS',
    });
    expect(Team.delete).not.toHaveBeenCalled();
  });

  it('reads naturally when exactly one ticket blocks it', async () => {
    stubTicketCount(1);

    await expect(TeamService.deleteTeam('team-1', 'admin-1')).rejects.toThrow(
      /has 1 ticket and cannot be deleted/
    );
  });

  it('404s for a team that does not exist', async () => {
    stubTicketCount(0);
    jest.spyOn(Team, 'findById').mockResolvedValue(null as any);

    await expect(TeamService.deleteTeam('nope', 'admin-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(Team.delete).not.toHaveBeenCalled();
  });
});
