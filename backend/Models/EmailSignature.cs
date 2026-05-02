namespace BOS.Backend.Models;

public class EmailSignature
{
    public int      Id              { get; set; }
    public string   OwnerUserEmail  { get; set; } = "";
    public string?  AliasEmail      { get; set; }
    public string   Name            { get; set; } = "";
    public string   BodyHtml        { get; set; } = "";
    public bool     IsDefault       { get; set; }
    public DateTime CreatedAt       { get; set; }
    public DateTime UpdatedAt       { get; set; }
}
