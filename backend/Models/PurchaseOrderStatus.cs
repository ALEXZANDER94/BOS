namespace BOS.Backend.Models;

public class PurchaseOrderStatus
{
    public int    Id        { get; set; }
    public string Name      { get; set; } = string.Empty;
    public string Color     { get; set; } = "#6b7280"; // default gray

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
}
