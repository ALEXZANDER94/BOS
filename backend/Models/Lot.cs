namespace BOS.Backend.Models;

public class Lot
{
    public int       Id         { get; set; }
    public int       BuildingId { get; set; }
    public Building? Building   { get; set; }

    public string Name        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int    SortOrder   { get; set; }

    // Optional Plan assignment — set after a multi-family proposal has been
    // converted and lots are added/assigned to a Plan via the Buildings & Lots tab.
    public int?  PlanId { get; set; }
    public Plan? Plan   { get; set; }

    public Address?                   Address        { get; set; }
    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = [];
}
