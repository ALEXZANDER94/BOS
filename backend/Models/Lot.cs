namespace BOS.Backend.Models;

public class Lot
{
    public int       Id         { get; set; }
    public int       BuildingId { get; set; }
    public Building? Building   { get; set; }

    public string Name        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public Address?                   Address        { get; set; }
    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = [];
}
