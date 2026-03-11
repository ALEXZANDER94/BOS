namespace BOS.Backend.Models;

public class Address
{
    public int   Id       { get; set; }
    public int   LotId    { get; set; }
    public Lot?  Lot      { get; set; }

    public string Address1 { get; set; } = string.Empty;
    public string Address2 { get; set; } = string.Empty;
    public string City     { get; set; } = string.Empty;
    public string State    { get; set; } = string.Empty;
    public string Zip      { get; set; } = string.Empty;
    public string Country  { get; set; } = string.Empty;
}
