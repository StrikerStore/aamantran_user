/**
 * EditInvitation — same as GenerateInvitation but accessed via /events/:id/edit.
 * We simply re-export GenerateInvitation since the form is identical
 * (edit vs generate is just a URL + label distinction).
 */
export { default } from './GenerateInvitation';
