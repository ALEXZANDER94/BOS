namespace BOS.Backend.Models;

// Join row: a CustomUpgrade has been "baked into" a Library.
// When a Proposal is created from this Library, all baked-in upgrades start ON.
public class LibraryUpgrade
{
    public int             LibraryId       { get; set; }
    public Library?        Library         { get; set; }

    public int             CustomUpgradeId { get; set; }
    public CustomUpgrade?  CustomUpgrade   { get; set; }
}
