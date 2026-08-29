// useTags.js - Tags composable for centralized API and state management
import { ref, reactive, computed } from 'vue';

// Shared reactive state
const tags = ref([]);

export function useTags() {
    // Reactive state
    const loading = ref(false);
    const error = ref(null);
    const showInactive = ref(false);
    const proposalTags = ref([]);
    const showTags = ref([]);
    const userTags = ref([]);
    const venueTags = ref([]);
    
    // Current filter state
    const activeTagFilter = ref(null); // Single tag ID for filtering
    
    // Computed properties
    const filteredTags = computed(() => {
        return tags.value.filter(tag => {
            // Filter by active/inactive status based on current view
            return showInactive.value ? !tag.is_visible_to_public : tag.is_visible_to_public;
        });
    });

    const activeTags = computed(() => tags.value.filter(tag => tag.is_visible_to_public));
    const inactiveTags = computed(() => tags.value.filter(tag => !tag.is_visible_to_public));
    
    const activeTagFilterObject = computed(() => {
        if (!activeTagFilter.value) return null;
        return tags.value.find(tag => tag.ID == activeTagFilter.value);
    });

    // API calls
    async function makeApiCall(endpoint, data, method='POST') {
        const response = await fetch('/tags'+endpoint, {
            method,
            headers: {
                Accept: 'application/json',
                ...(method !== 'GET' ? {
                    'Content-Type': 'application/json'
                } : {})
            },
            body: method !== 'GET' && data ? JSON.stringify(data) : undefined,
            params: method === 'GET' ? data ?? {} : {}
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (response.status === 204) return;

        return await response.json();
    }

    // Load all tags
    async function loadTags(reload = false) {
        if (tags.value.length && !reload) return;
        
        loading.value = true;
        error.value = null;

        try {
            tags.value = [{ name: '', description: '' }];
            const result = await makeApiCall('/', { active: true }, 'GET');
            tags.value = Array.isArray(result?.tags) ? result.tags : [];
        } catch (err) {
            error.value = err.message;
            console.error('Error loading tags:', err);
        } finally {
            loading.value = false;
        }
    }

    // Create a new tag
    async function createTag(tagData) {
        loading.value = true;
        error.value = null;

        try {
            const result = await makeApiCall('/', {
                name: tagData.name,
                emoji: tagData.emoji || '',
                description: tagData.description || '',
                is_visible_to_public: tagData.is_visible_to_public ?? false
            });
            
            if (result && result.id) {
                // Reload tags to get the fresh list
                await loadTags(true);
                return result;
            }
            
            throw new Error('Failed to create tag');
        } catch (err) {
            error.value = err.message;
            console.error('Error creating tag:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // Update tag
    async function updateTag(tagid, tagData) {
        loading.value = true;
        error.value = null;

        try {
            const result = await makeApiCall('/' + tagid, tagData, 'PUT');
            // Update local tags array
            const index = tags.value.findIndex(t => t.id == tagid);
            if (index !== -1) {
                Object.assign(tags.value[index], tagData);
            }
            return true;
        } catch (err) {
            error.value = err.message;
            console.error('Error updating tag:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // Link tag to proposal
    async function linkTagToProposal(tagid, proposalid) {
        try {
            const result = await makeApiCall(`/${tagid}/proposal/${proposalid}`, null, 'PUT');
            return true;
        } catch (err) {
            console.error('Error linking tag to proposal:', err);
            throw err;
        }
    }

    // Link tag to show
    async function linkTagToShow(tagid, showid) {
        try {
            const result = await makeApiCall(`/${tagid}/show/${showid}`, null, 'PUT');
            return true;
        } catch (err) {
            console.error('Error linking tag to show:', err);
            throw err;
        }
    }

    // Link tag to user
    async function linkTagToUser(tagid, userid) {
        try {
            const result = await makeApiCall(`/${tagid}/user/${userid}`, null, 'PUT');
            return true;
        } catch (err) {
            console.error('Error linking tag to user:', err);
            throw err;
        }
    }

    // Link tag to venue
    async function linkTagToVenue(tagid, venueid) {
        try {
            const result = await makeApiCall(`/${tagid}/venue/${venueid}`, null, 'PUT');
            return true;
        } catch (err) {
            console.error('Error linking tag to venue:', err);
            throw err;
        }
    }

    // Unlink tag from proposal
    async function unlinkTagFromProposal(tagid, proposalid) {
        try {
            const result = await makeApiCall(`/${tagid}/proposal/${proposalid}`, null, 'DELETE');
            return true;
        } catch (err) {
            console.error('Error unlinking tag from proposal:', err);
            throw err;
        }
    }

    // Unlink tag from show
    async function unlinkTagFromShow(tagid, showid) {
        try {
            const result = await makeApiCall(`/${tagid}/venue/${showid}`, null, 'DELETE');
            return true;
        } catch (err) {
            console.error('Error unlinking tag from show:', err);
            throw err;
        }
    }

    // Unlink tag from user
    async function unlinkTagFromUser(tagid, userid) {
        try {
            const result = await makeApiCall(`/${tagid}/venue/${userid}`, null, 'DELETE');
            return true;
        } catch (err) {
            console.error('Error unlinking tag from user:', err);
            throw err;
        }
    }

    // Unlink tag from venue
    async function unlinkTagFromVenue(tagid, venueid) {
        try {
            const result = await makeApiCall(`/${tagid}/venue/${venueid}`, null, 'DELETE');
            return true;
        } catch (err) {
            console.error('Error unlinking tag from venue:', err);
            throw err;
        }
    }

    // Get tags for a proposal
    async function getTagsForProposal(id) {
        try {
            const result = await makeApiCall('/proposal/' + id, null, 'GET');
            if (!Array.isArray(result?.tags)) return [];
            proposalTags.value = result.tags;
            return result;
        } catch (err) {
            console.error('Error getting tags for proposal:', err);
            return [];
        }
    }

    // Get tags for a show
    async function getTagsForShow(id) {
        try {
            const result = await makeApiCall('/show/' + id, null, 'GET');
            if (!Array.isArray(result?.tags)) return [];
            showTags.value = result.tags;
            return result;
        } catch (err) {
            console.error('Error getting tags for show:', err);
            return [];
        }
    }

    // Get tags for a user
    async function getTagsForUser(id) {
        try {
            const result = await makeApiCall('/user/' + id, null, 'GET');
            if (!Array.isArray(result?.tags)) return [];
            userTags.value = result.tags;
            return result;
        } catch (err) {
            console.error('Error getting tags for user:', err);
            return [];
        }
    }

    // Get tags for a venue
    async function getTagsForVenue(id) {
        try {
            const result = await makeApiCall('/venue/' + id, null, 'GET');
            if (!Array.isArray(result?.tags)) return [];
            venueTags.value = result.tags;
            return result;
        } catch (err) {
            console.error('Error getting tags for venue:', err);
            return [];
        }
    }

    // Search tags (for autocomplete)
    async function searchTags(searchTerm, limit = 10) {
        const searchUpper = searchTerm.trim().toUpperCase();
        return tags.value.filter(t => t.name.toUpperCase().includes(searchUpper) || t.emoji?.includes(searchTerm));
    }

    // Set tag filter for calendar/schedule
    function setTagFilter(tagid) {
        activeTagFilter.value = tagid;
    }

    // Clear tag filter
    function clearTagFilter() {
        activeTagFilter.value = null;
    }

    // Format tag display text
    function formatTagDisplay(tag) {
        if (!tag) return '';
        return (tag.emoji ? tag.emoji + ' ' : '') + tag.name;
    }

    // Check if shows match current tag filter
    function matchesTagFilter(showTags) {
        if (!activeTagFilter.value) return true;
        return Array.isArray(showTags) && showTags.some(tag => tag.id == activeTagFilter.value);
    }

    return {
        // State
        tags,
        proposalTags,
        showTags,
        userTags,
        venueTags,
        loading,
        error,
        showInactive,
        activeTagFilter,
        
        // Computed
        filteredTags,
        activeTags,
        inactiveTags,
        activeTagFilterObject,
        
        // Methods
        loadTags,
        createTag,
        updateTag,
        linkTagToProposal,
        linkTagToShow,
        linkTagToUser,
        linkTagToVenue,
        unlinkTagFromProposal,
        unlinkTagFromShow,
        unlinkTagFromUser,
        unlinkTagFromVenue,
        getTagsForProposal,
        getTagsForShow,
        getTagsForUser,
        getTagsForVenue,
        searchTags,
        setTagFilter,
        clearTagFilter,
        formatTagDisplay,
        matchesTagFilter
    };
}
