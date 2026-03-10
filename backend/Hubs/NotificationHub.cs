using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BOS.Backend.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    // Server-push only hub — no client-callable methods needed.
    // The server uses IHubContext<NotificationHub> to push notifications.
}
