const {createMatchStoryPost}=require('./matchStoryApi');
function createMatchStoryPreviewPost(service){return createMatchStoryPost(service,{responseKey:'preview'});}
module.exports={createMatchStoryPreviewPost};
