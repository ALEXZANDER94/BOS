using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/client/{clientId:int}/contact")]
public class ContactController : ControllerBase
{
    private readonly IContactService _contacts;

    public ContactController(IContactService contacts) => _contacts = contacts;

    // GET /api/client/1/contact
    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] int clientId)
        => Ok(await _contacts.GetAllAsync(clientId));

    // POST /api/client/1/contact
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromRoute] int clientId,
        [FromBody] CreateContactRequest request)
    {
        var contact = await _contacts.CreateAsync(clientId, request);
        return Ok(contact);
    }

    // PUT /api/client/1/contact/3
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        [FromRoute] int clientId,
        int id,
        [FromBody] UpdateContactRequest request)
    {
        var (contact, error) = await _contacts.UpdateAsync(clientId, id, request);
        if (contact is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });
        return Ok(contact);
    }

    // DELETE /api/client/1/contact/3
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete([FromRoute] int clientId, int id)
    {
        var deleted = await _contacts.DeleteAsync(clientId, id);
        return deleted ? NoContent() : NotFound();
    }
}
