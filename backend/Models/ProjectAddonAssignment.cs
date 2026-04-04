namespace BOS.Backend.Models;

public class ProjectAddonAssignment
{
    public int          Id        { get; set; }
    public int          AddonId   { get; set; }
    public ClientAddon? Addon     { get; set; }
    public int          ProjectId { get; set; }
    public Project?     Project   { get; set; }
    public decimal?     Price     { get; set; }
}
