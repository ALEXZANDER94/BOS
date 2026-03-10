using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace BOS.Backend.Hubs;

/// <summary>
/// Maps SignalR connections to users by their email claim instead of the default
/// NameIdentifier claim. This lets IHubContext.Clients.User(email) route correctly.
/// </summary>
public class EmailUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
        => connection.User?.FindFirstValue(ClaimTypes.Email);
}
