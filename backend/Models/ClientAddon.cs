namespace BOS.Backend.Models;

public class ClientAddon
{
    public int     Id       { get; set; }
    public int     ClientId { get; set; }
    public Client? Client   { get; set; }

    public string Code        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Notes       { get; set; } = string.Empty;

    public ICollection<ProjectAddonAssignment> Assignments { get; set; } = [];
}
