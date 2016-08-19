# MolVR: A protein-viewer *DRAFT*
## An immersive VR environment for viewing and discussing complex biological proteins ##
### Version 0.1 - Demo environment

Developed by Tom Skillman and Steven Vergenz

## Application:

We have created a room-size immersive VR environment for the study of the atomic structure of complex proteins. It significantly increases your ability to understand the form and function of intermolecular interactions. 

This AltspaceVR application brings this VR environment into a shared VR-space where multiple people can enter to view and discuss proteins, sharing a common view of the protein, walking around (and through) the protein, while discussing it with audio connectivity. All interactively and in real-time. While many viewing platforms are supported, our experience is that the immersive goggle systems such as Vive and Oculus provide a significantly richer immersive environment and highly recommend using those types of devices when using this application.

Researchers, scientists, educators, and students can now collaboratively develop an understanding of molecular structure and interactions.

This demo was designed to specifically look at protein components of the immune system. Your immune system is a complex set of molecular components that work together to identify viruses and bacteria that are invading your body. It is what takes a few days to figure out what's attacking you and how to kill it. It is also what can cause you severe problems if your immune system gets confused and starts attacking your own cells instead of foreign cells. When this happens you see diseases such as Type I Diabetes (pancreas attacked), Multiple Sclerosis (brain attacked), or Rheumatoid Arthritis (joints attacked). Research centers such as Benaroya Autoimmune Research Institute in Seattle are working to find a cure for these diseases by understanding autoimmune dysfunction, and finding a way to repair it, that is, a cure. 

The demo is preloaded with several key protein structures that work together in a cell to present peptide fragments (e.g., virus fragments) from the interior of the host cell onto its exterior cell surface. It does this at a very well defined location and orientation. The peptide is held in place by a molecular "groove". The specific shape of this groove and the way it holds the peptide is key to the proper operation of the immune system. Once on the cell surface, another component of the immune system, a Killer T-cell, can "inspect" the peptide in the groove and if it is recognized as a "normal" part of the host cell biology (self) no action is taken. If however the peptide is recognized as not part of the normal cell (not-self) the Kill T-cell attacks the host cell and destroys it, thereby halting that cell from producing and spreading additional virus.

     If this is all new to you, you might want to view this 6 minute video (https://www.youtube.com/watch?v=VPvCekgPwRI) that shows the details of the immune recognition process.

You can run this demo yourself and explore proteins, or you can sign up for full interactive demos where you can join others, and a moderator, to literally walk through (Vive) an example: A piece of virus bound it the groove awaiting inspection by the Killer T-cell. You can view the "atomic" structure to see binding details, or the approximating "ribbon" model that will help you get oriented to the overall molecular structure, with helices and sheets creating the structure that is the "groove".

## Application Implementation:

*Steven - I thought you might want to enhance this section to explain the key aspects of how your app works, but it is totally up to you whether or not you want to.*

This AltspaceVR application is coded in javascript, making use of the three.js and altspace.js libraries. It loads protein atom-and-bond models from a ".pdb" formated file, along with corresponding ".obj/.mtl" ribbon model files for those proteins. The pdb files come from the excellent Protein Data Bank (http://www.rcsb.org/). The obj/mtl files were generate using the excellent Visual Molecular Dynamics tool (http://www.ks.uiuc.edu/Research/vmd/).

The pdb file is read to create the atom-and-bond model. The protein models are loaded, scaled, translated, and rotated as needed to fit the VR room and to be oriented in a biologically understandable way. 

A VR enclosure is created and the model is rendered. The type of viewing hardware that is being used by a guest is identified and the rendering mode is adjusted to enable the largest possible number of viewing platforms.

A User Interface (UI) is available to the host of the MolVR application, the person who creates the AltspaceVR room and shares its URL address with other guests.  The UI enables selection of different PDB proteins, and whether to display the structure (ribbon) or bond (atom-and-bonds) view. There is a web browser embedded in the room so that you can access other related reference materials without leaving VR.

## Future Plans 
*Steven, Do we want to map this out or not?  It could be our near-term (post Altspace funding) goals, or we could map out a long-term "ideal user scenario" that could focus contributing work for some time to come. Your thoughts?*

* item 1
* item 2
  * item 2a
  


